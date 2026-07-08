// Warehouse inventory: pure helpers + category/status metadata. Data loaders
// live below (Task 3). Money is in satang. Stock status thresholds live here so
// the rule is defined once.

import { createClient } from "./supabase/server";

export type ProductCategory =
  | "rfid_readers"
  | "antennas"
  | "tags"
  | "printers"
  | "networking"
  | "accessories"
  | "software";

export type StockStatus = "in_stock" | "low" | "out";

/** Out when nothing on hand; low when at/under the safety threshold. */
export function stockStatus(qtyOnHand: number, safetyStock: number): StockStatus {
  if (qtyOnHand <= 0) return "out";
  if (qtyOnHand <= safetyStock) return "low";
  return "in_stock";
}

/** On-hand stock value in satang. */
export function stockValue(qtyOnHand: number, cost: number): number {
  return qtyOnHand * cost;
}

export const PRODUCT_CATEGORIES: { code: ProductCategory; labelKey: string }[] = [
  { code: "rfid_readers", labelKey: "inventory.category.rfid_readers" },
  { code: "antennas", labelKey: "inventory.category.antennas" },
  { code: "tags", labelKey: "inventory.category.tags" },
  { code: "printers", labelKey: "inventory.category.printers" },
  { code: "networking", labelKey: "inventory.category.networking" },
  { code: "accessories", labelKey: "inventory.category.accessories" },
  { code: "software", labelKey: "inventory.category.software" },
];

export const STOCK_STATUS_COLORS: Record<StockStatus, { bg: string; fg: string }> = {
  in_stock: { bg: "#dcfce7", fg: "#15803d" },
  low: { bg: "#fef9c3", fg: "#a16207" },
  out: { bg: "#fee2e2", fg: "#b91c1c" },
};

export function isProductCategory(v: string): v is ProductCategory {
  return PRODUCT_CATEGORIES.some((c) => c.code === v);
}

export interface ProductRow {
  id: string;
  code: string;
  name: string;
  category: ProductCategory;
  unit: string;
  cost: number; // satang
  sell_price: number; // satang
  qty_on_hand: number;
  safety_stock: number;
  is_active: boolean;
}

export interface ProductDetail extends ProductRow {
  description: string | null;
  datasheet_url: string | null;
}

export interface InventorySummary {
  skuCount: number;
  lowOutCount: number;
  stockValue: number; // satang
}

export interface ProductListFilters {
  q?: string;
  category?: string;
  status?: string; // "all" | StockStatus
}

export interface ProductListResult {
  rows: ProductRow[];
  summary: InventorySummary;
}

const PRODUCT_COLS =
  "id, code, name, category, unit, cost, sell_price, qty_on_hand, safety_stock, is_active";

export async function listProducts(
  filters: ProductListFilters
): Promise<ProductListResult> {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select(PRODUCT_COLS)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (filters.category && isProductCategory(filters.category)) {
    query = query.eq("category", filters.category);
  }
  if (filters.q && filters.q.trim()) {
    const term = `%${filters.q.trim()}%`;
    query = query.or(`name.ilike.${term},code.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  let rows = (data ?? []) as ProductRow[];

  // Status is derived, so filter it in memory.
  if (filters.status && filters.status !== "all") {
    rows = rows.filter(
      (r) => stockStatus(r.qty_on_hand, r.safety_stock) === filters.status
    );
  }

  const summary: InventorySummary = {
    skuCount: rows.length,
    lowOutCount: rows.filter(
      (r) => stockStatus(r.qty_on_hand, r.safety_stock) !== "in_stock"
    ).length,
    stockValue: rows.reduce((sum, r) => sum + stockValue(r.qty_on_hand, r.cost), 0),
  };

  return { rows, summary };
}

export async function getProduct(id: string): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(`${PRODUCT_COLS}, description, datasheet_url`)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as ProductDetail;
}
