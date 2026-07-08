// Warehouse inventory: pure helpers + category/status metadata. Data loaders
// live below (Task 3). Money is in satang. Stock status thresholds live here so
// the rule is defined once.

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
