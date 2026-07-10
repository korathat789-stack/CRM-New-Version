/** @jsxRuntime automatic */
/** @jsxImportSource react */
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToBuffer } from "@react-pdf/renderer";
import { QuotationPdf } from "../QuotationPdf";
import type { QuotationPdfData } from "@/lib/quotations";

const fixture: QuotationPdfData = {
  number: "Q-MPT-TEST-1",
  quotationDate: "2026-07-07",
  validityDays: 30,
  vatRatePct: 7,
  subtotal: 84_575_000,
  vatAmount: 5_920_250,
  total: 90_495_250,
  remark: "Not included installation fee",
  paymentTerms: [{ percent: 100, condition: "Against Purchase Order (for stock goods)" }],
  salesPerson: "Sirirat",
  items: [
    { line_no: 1, model: "IPJ-REV-R420", description: "UHF fixed reader", category: "อุปกรณ์ RFID", qty: 3, uom: "", unit_price: 8_800_000, amount: 26_400_000 },
    { line_no: 2, model: "", description: "Location tracking software", category: "Software", qty: 1, uom: "", unit_price: 40_000_000, amount: 40_000_000 },
  ],
  customer: {
    name: "บริษัท ท็อปเบสท์ จำกัด",
    address: "202/22 ถนนแจ้งวัฒนะ หลักสี่ กรุงเทพฯ 10210",
    province: "กรุงเทพฯ",
    taxId: null,
    contactName: "คุณยงยุทธ",
    contactTitle: "IT Manager",
    contactPhone: null,
    contactEmail: "yongyoot.n@topbest.co.th",
  },
};

test("QuotationPdf renders to a non-empty PDF buffer", async () => {
  const buf = await renderToBuffer(<QuotationPdf data={fixture} />);
  assert.ok(buf.length > 1000, "buffer should be a real PDF");
  assert.equal(buf.subarray(0, 5).toString("latin1"), "%PDF-");
});
