// Warehouse inventory: Supabase-backed data loaders (Task 3). Money is in
// satang. Pure helpers + category/status metadata that are safe for client
// components live in `./inventory-shared` and are re-exported here so
// existing server-side imports keep working unchanged.

import { createClient } from "./supabase/server";
import {
  isProductCategory,
  stockStatus,
  stockValue,
  PRODUCT_CATEGORIES,
  STOCK_STATUS_COLORS,
  type ProductCategory,
  type StockStatus,
} from "./inventory-shared";

export {
  isProductCategory,
  stockStatus,
  stockValue,
  PRODUCT_CATEGORIES,
  STOCK_STATUS_COLORS,
  type ProductCategory,
  type StockStatus,
};

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
