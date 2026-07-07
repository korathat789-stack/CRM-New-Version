// Pure, client-safe helpers for the quotation PDF document. No DB imports.

export interface QuotationPaymentTerm {
  percent: number;
  condition: string;
}

export interface PdfItemInput {
  line_no: number;
  model: string | null;
  description: string;
  category: string | null;
  qty: number;
  uom: string | null;
  unit_price: number; // satang
  amount: number; // satang
}

export type PdfTableRow =
  | { kind: "subheader"; category: string }
  | {
      kind: "item";
      no: number;
      model: string;
      description: string;
      qty: number;
      uom: string;
      unitPrice: number; // satang
      amount: number; // satang
    };

/** Turn ordered items into render rows, inserting a sub-header row whenever the
 *  (non-empty) category changes. Items are numbered sequentially (sub-headers
 *  are not numbered). */
export function groupLinesByCategory(items: PdfItemInput[]): PdfTableRow[] {
  const rows: PdfTableRow[] = [];
  let currentCategory: string | null = null;
  let no = 0;
  for (const it of items) {
    const cat = (it.category ?? "").trim();
    if (cat && cat !== currentCategory) {
      rows.push({ kind: "subheader", category: cat });
      currentCategory = cat;
    } else if (!cat) {
      currentCategory = null;
    }
    no += 1;
    rows.push({
      kind: "item",
      no,
      model: it.model ?? "",
      description: it.description,
      qty: it.qty,
      uom: it.uom ?? "",
      unitPrice: it.unit_price,
      amount: it.amount,
    });
  }
  return rows;
}

/** Amount (satang) for a payment-term percentage of the grand total. */
export function paymentRowAmount(totalSatang: number, percent: number): number {
  return Math.round(((totalSatang || 0) * (percent || 0)) / 100);
}

/** Safe download filename from a quote number. */
export function pdfFilename(quoteNumber: string | null): string {
  const base = (quoteNumber ?? "").trim();
  if (!base) return "quotation.pdf";
  const safe = base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safe || "quotation"}.pdf`;
}
