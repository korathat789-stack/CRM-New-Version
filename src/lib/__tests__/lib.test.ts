import { test } from "node:test";
import assert from "node:assert/strict";

import { formatBaht, formatBahtShort, parseBahtToSatang, bahtToSatang, formatMoney2 } from "../money";
import { computeGrade, gradeForCustomer } from "../grade";
import { marginPct, marginTone, formatMarginPct } from "../margin";
import { lineAmount, computeTotals } from "../quotation";
import { evaluateGate, completeness, nextStage, type GateContext } from "../gates";
import {
  groupLinesByCategory,
  paymentRowAmount,
  pdfFilename,
} from "../quotationPdfModel";

// ---------------------------------------------------------------- money
test("money: short form uses M/K and trims zeros", () => {
  assert.equal(formatBahtShort(840_000_000), "฿8.4M"); // 8,400,000 baht
  assert.equal(formatBahtShort(50_000_000), "฿500K"); // 500,000 baht
  assert.equal(formatBahtShort(12_000), "฿120"); // 120 baht
  assert.equal(formatBahtShort(null), "฿—");
});

test("money: full form groups thousands; null → em dash", () => {
  assert.equal(formatBaht(185_000_000), "฿1,850,000");
  assert.equal(formatBaht(null), "—");
});

test("money: parse baht string to integer satang", () => {
  assert.equal(parseBahtToSatang("8,400,000"), 840_000_000);
  assert.equal(parseBahtToSatang(""), null);
  assert.equal(bahtToSatang(85_000), 8_500_000);
});

// ---------------------------------------------------------------- grade
test("grade: bands at boundaries (A≥5M…F)", () => {
  assert.equal(computeGrade(bahtToSatang(5_000_000)), "A");
  assert.equal(computeGrade(bahtToSatang(4_999_999)), "B");
  assert.equal(computeGrade(bahtToSatang(2_000_000)), "B");
  assert.equal(computeGrade(bahtToSatang(500_000)), "C");
  assert.equal(computeGrade(bahtToSatang(100_000)), "D");
  assert.equal(computeGrade(bahtToSatang(99_999)), "F");
  assert.equal(computeGrade(0), "F");
});

test("grade: basis selects the right revenue field", () => {
  const c = { annual_revenue: bahtToSatang(600_000), lifetime_revenue: bahtToSatang(6_000_000) };
  assert.equal(gradeForCustomer(c, "annual"), "C"); // ฿600K → C band
  assert.equal(gradeForCustomer(c, "lifetime"), "A"); // ฿6M → A band
});

// ---------------------------------------------------------------- margin
test("margin: divide-by-zero guard returns null → em dash", () => {
  assert.equal(marginPct(0, 0), null);
  assert.equal(marginPct(null, 100), null);
  assert.equal(formatMarginPct(marginPct(0, 0)), "—");
});

test("margin: percent + tone thresholds", () => {
  assert.equal(Math.round(marginPct(100, 70)!), 30);
  assert.equal(marginTone(35), "green");
  assert.equal(marginTone(25), "amber");
  assert.equal(marginTone(10), "red");
  assert.equal(marginTone(null), null);
});

// ---------------------------------------------------------------- quotation
test("quotation: line amount applies per-line discount", () => {
  assert.equal(lineAmount({ unit_price: 8_500_000, qty: 8, discount_pct: 0 }), 68_000_000);
  assert.equal(lineAmount({ unit_price: 8_500_000, qty: 8, discount_pct: 10 }), 61_200_000);
});

test("quotation: totals — subtotal + vat = total in both modes", () => {
  const lines = [
    { unit_price: 100_000_00, qty: 1, discount_pct: 0 }, // 1,000,000 baht
  ];
  const excl = computeTotals(lines, 7, "excluded");
  assert.equal(excl.subtotal, 100_000_00);
  assert.equal(excl.vat, Math.round(100_000_00 * 0.07));
  assert.equal(excl.subtotal + excl.vat, excl.total);

  const incl = computeTotals(lines, 7, "included");
  assert.equal(incl.total, 100_000_00);
  assert.equal(incl.subtotal + incl.vat, incl.total);
});

// ---------------------------------------------------------------- gates
function ctx(overrides: Partial<GateContext> = {}): GateContext {
  return {
    customerName: true,
    customerType: true,
    customerOwner: true,
    oppValue: true,
    presentationLogged: false,
    quoteNumber: false,
    quoteAmount: false,
    quoteSent: false,
    pocScheduled: false,
    pocResult: false,
    signedQuote: false,
    authorized: false,
    ...overrides,
  };
}

test("gates: presentation gate met when customer + value complete", () => {
  assert.equal(evaluateGate("presentation", ctx()).met, true);
  assert.equal(evaluateGate("presentation", ctx({ oppValue: false })).met, false);
});

test("gates: quotation gate blocked until presentation logged", () => {
  const e = evaluateGate("quotation", ctx());
  assert.equal(e.met, false);
  assert.equal(e.missing[0].key, "presentationLogged");
  assert.equal(evaluateGate("quotation", ctx({ presentationLogged: true })).met, true);
});

test("gates: completeness percent reflects met requirements", () => {
  const none = completeness(ctx({ customerName: false, customerType: false, customerOwner: false, oppValue: false }));
  assert.equal(none.percent, 0);
  const all = completeness(
    ctx({
      presentationLogged: true,
      quoteNumber: true,
      quoteAmount: true,
      quoteSent: true,
      pocScheduled: true,
      pocResult: true,
      signedQuote: true,
      authorized: true,
    })
  );
  assert.equal(all.percent, 100);
});

test("gates: linear advance order", () => {
  assert.equal(nextStage("inquiry"), "presentation");
  assert.equal(nextStage("negotiation"), "won");
  assert.equal(nextStage("won"), null);
});

import { navTitleKey } from "../roles";
import { initialsFrom } from "../initials";

// ---------------------------------------------------------------- navTitleKey
test("navTitleKey: exact and nested routes map to the nav label", () => {
  assert.equal(navTitleKey("/dashboard"), "nav.dashboard");
  assert.equal(navTitleKey("/customers"), "nav.customers");
  assert.equal(navTitleKey("/customers/CUS-000001"), "nav.customers");
  assert.equal(navTitleKey("/customers/CUS-000001/edit"), "nav.customers");
});

test("navTitleKey: longest prefix wins for nested settings routes", () => {
  assert.equal(navTitleKey("/settings"), "nav.settings");
  assert.equal(navTitleKey("/settings/users"), "nav.users");
  assert.equal(navTitleKey("/settings/import"), "nav.import");
});

test("navTitleKey: unknown route falls back to dashboard", () => {
  assert.equal(navTitleKey("/nope"), "nav.dashboard");
});

// ---------------------------------------------------------------- initialsFrom
test("initialsFrom: uses up to two name words, uppercased", () => {
  assert.equal(initialsFrom("Somchai Prasert", "a@b.co"), "SP");
  assert.equal(initialsFrom("madonna", "a@b.co"), "M");
  assert.equal(initialsFrom("  ก ข ค ", "a@b.co"), "กข");
});

test("initialsFrom: falls back to email, then '?'", () => {
  assert.equal(initialsFrom(null, "korat@example.com"), "K");
  assert.equal(initialsFrom("", ""), "?");
  assert.equal(initialsFrom(null, null), "?");
});

// ---------------------------------------------------------------- quotation pdf model
test("formatMoney2: satang → baht, 2 decimals, grouped, no ฿", () => {
  assert.equal(formatMoney2(84_575_000), "845,750.00");
  assert.equal(formatMoney2(90_495_250), "904,952.50");
  assert.equal(formatMoney2(0), "0.00");
  assert.equal(formatMoney2(5_000_00), "5,000.00");
});

test("paymentRowAmount: round(total * percent / 100)", () => {
  assert.equal(paymentRowAmount(90_495_250, 100), 90_495_250);
  assert.equal(paymentRowAmount(90_495_250, 50), 45_247_625);
  assert.equal(paymentRowAmount(100, 0), 0);
});

test("pdfFilename: number → safe .pdf name; null → quotation.pdf", () => {
  assert.equal(pdfFilename("Q-MPT-6606030"), "Q-MPT-6606030.pdf");
  assert.equal(pdfFilename(null), "quotation.pdf");
  assert.equal(pdfFilename("Q/MPT 01"), "Q-MPT-01.pdf");
});

test("groupLinesByCategory: subheader on category change; items numbered sequentially; blank category → no header", () => {
  const rows = groupLinesByCategory([
    { line_no: 1, model: "M1", description: "A", category: "RFID", qty: 3, uom: "", unit_price: 100, amount: 300 },
    { line_no: 2, model: "", description: "B", category: "RFID", qty: 1, uom: "pcs", unit_price: 50, amount: 50 },
    { line_no: 3, model: "", description: "C", category: "Software", qty: 1, uom: "", unit_price: 400, amount: 400 },
    { line_no: 4, model: "", description: "D", category: null, qty: 2, uom: "", unit_price: 10, amount: 20 },
  ]);
  assert.deepEqual(
    rows.map((r) => (r.kind === "subheader" ? `#${r.category}` : `${r.no}:${r.description}`)),
    ["#RFID", "1:A", "2:B", "#Software", "3:C", "4:D"]
  );
});
