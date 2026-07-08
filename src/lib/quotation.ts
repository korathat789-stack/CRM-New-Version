// Quotation math — single source of truth. Money is integer satang.
// Per-line discount is a percentage (0–100). VAT is a percentage applied either
// "excluded" (added on top) or "included" (already inside the line prices).

export interface QuotationLineInput {
  description: string;
  unit_price: number; // satang
  qty: number;
  discount_pct: number; // 0..100
  model?: string | null;
  uom?: string | null;
  category?: string | null;
}

export type VatMode = "excluded" | "included";

/** Line amount = round(unit_price * qty * (1 - discount/100)), in satang. */
export function lineAmount(line: {
  unit_price: number;
  qty: number;
  discount_pct: number;
}): number {
  const pct = clampPct(line.discount_pct);
  const gross = (line.unit_price || 0) * (line.qty || 0);
  return Math.round(gross * (1 - pct / 100));
}

export interface QuotationTotals {
  subtotal: number; // ex-VAT base, satang
  vat: number; // satang
  total: number; // grand total, satang
}

/**
 * Totals such that subtotal + vat = total in BOTH modes:
 *  - excluded: subtotal = Σ line amounts; vat = subtotal * rate; total = sum
 *  - included: total = Σ line amounts; vat = total - total/(1+rate); subtotal = total - vat
 */
export function computeTotals(
  lines: { unit_price: number; qty: number; discount_pct: number }[],
  vatRatePct: number,
  mode: VatMode
): QuotationTotals {
  const sum = lines.reduce((acc, l) => acc + lineAmount(l), 0);
  const rate = Math.max(0, vatRatePct) / 100;

  if (mode === "included") {
    const base = rate > 0 ? Math.round(sum / (1 + rate)) : sum;
    return { subtotal: base, vat: sum - base, total: sum };
  }
  const vat = Math.round(sum * rate);
  return { subtotal: sum, vat, total: sum + vat };
}

function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}

export const CREDIT_TERMS = [15, 30, 45, 60] as const;
