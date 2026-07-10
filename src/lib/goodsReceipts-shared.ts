// Goods receipt: pure, client-safe types + helpers + status metadata. Server
// loaders live in goodsReceipts.ts. Keeping this module free of Supabase imports
// lets client components import the status metadata without pulling server code.

export type GoodsReceiptStatus = "pending" | "approved" | "rejected";

/** Sum the line quantities of a receipt. */
export function receiptTotalQty(items: { qty: number }[]): number {
  return items.reduce((sum, i) => sum + i.qty, 0);
}

/** Only a pending receipt can be edited or deleted. */
export function canEditReceipt(status: GoodsReceiptStatus): boolean {
  return status === "pending";
}

/** Only a pending receipt can be approved or rejected. */
export function canApproveReceipt(status: GoodsReceiptStatus): boolean {
  return status === "pending";
}

export const GR_STATUS_COLORS: Record<
  GoodsReceiptStatus,
  { bg: string; fg: string }
> = {
  pending: { bg: "#fef9c3", fg: "#a16207" },
  approved: { bg: "#dcfce7", fg: "#15803d" },
  rejected: { bg: "#fee2e2", fg: "#b91c1c" },
};

export const GR_STATUS_LABEL_KEYS: Record<GoodsReceiptStatus, string> = {
  pending: "goodsReceipts.status.pending",
  approved: "goodsReceipts.status.approved",
  rejected: "goodsReceipts.status.rejected",
};

export function isGoodsReceiptStatus(v: string): v is GoodsReceiptStatus {
  return v === "pending" || v === "approved" || v === "rejected";
}
