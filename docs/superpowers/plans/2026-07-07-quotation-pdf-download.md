# Quotation PDF Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Download action on each `/quotations` row that returns a PDF faithful to the MatchPoint "ESTIMATED PRICE" template, generated with `@react-pdf/renderer`, plus the schema + form fields the template needs.

**Architecture:** An additive migration (`0005`) adds per-line Model/UOM/category, quote validity, payment terms, and a customer address. `QuotationForm`/`CustomerForm` capture them. A pure model module derives the document's table rows + money strings; a server loader assembles a `QuotationPdfData`; a `@react-pdf/renderer` `<Document>` (fonts embedded) renders it; a GET route streams it as an attachment. Fixed seller info is a code constant.

**Tech Stack:** Next.js 15 App Router (route handlers), React 19, TypeScript strict, Tailwind v4, Supabase (`@supabase/ssr`), `@react-pdf/renderer`, next-intl. Tests: Node test runner (`node --import tsx --test`).

## Global Constraints

- Document title is **"ESTIMATED PRICE"** (the template's own title was "ESTIMATED COST"; the user changed it).
- Document labels are English; data (line descriptions, category names, customer text) renders as entered (may be Thai) — embed **Sarabun** (covers Latin + Thai) as the single PDF font.
- Money in the PDF uses `formatMoney2` → grouped thousands, exactly 2 decimals, **no ฿ symbol** (e.g. `845,750.00`); column/total unit is "THB". The app's existing `formatBaht` (฿, no decimals) is unchanged.
- Migration `0005` is **additive only** (new nullable/defaulted columns); no drops, no RLS change. Money stays integer satang.
- Do NOT fabricate data (CLAUDE.md rule 6): the template shows **no Tax ID**, so the document/company config omits Tax ID. Real seller values are transcribed verbatim from the template (given below).
- The PDF shows **no per-line discount column** (template has none); `discount_pct` still feeds each line `amount` as today.
- TypeScript strict; no `any` in shipped code. Design tokens for any in-app UI (no hard-coded hexes in components). `src/lib/quotationPdfModel.ts` is client-safe (no DB imports).
- Only `@react-pdf/renderer` is added as a dependency. Deploy + remote migration are deferred/ops steps (not run by implementers).

## Seller constants (verbatim from the template — use exactly)

- Legal name: `MATCHPOINT TECHNOLOGY CO.,LTD.`  · note `(Head Office)`
- Address: `1917 moo10, Soi Baring 36, Sukhumvit 107 Road, Samrongnua, Muangsamutprakarn, Samutprakarn 10270`
- Tel: `02-743-2533`  · Fax: `02-743-2533#101`  · Cell Phone: `086-3183065`
- Default signatory: name `Gunyarat Choksuntasut`, title `MANAGER`
- Intro line: `According to your requirements we are truly pleased to submit the following offer for your kind consideration`
- Legal line: `By signing below, the client has approved and accepted the above terms and conditions of this quotation with fully understanding and acceptance that this document can legally be used as a purchase Order.`
- Default payment term row: `{ percent: 100, condition: "Against Purchase Order (for stock goods)" }`

---

### Task 1: Add `@react-pdf/renderer` + embed Sarabun fonts

**Files:**
- Modify: `package.json`
- Create: `src/lib/pdf/fonts/Sarabun-Regular.ttf`, `src/lib/pdf/fonts/Sarabun-Bold.ttf`
- Modify: `next.config.ts` (trace the font files into the route bundle)

- [ ] **Step 1: Install the dependency**

Run: `npm install @react-pdf/renderer`
Expected: `package.json` gains `@react-pdf/renderer`; install succeeds.

- [ ] **Step 2: Add the Sarabun font files**

Download the two TTFs (Apache-2.0, from Google Fonts) into `src/lib/pdf/fonts/`:
```bash
mkdir -p src/lib/pdf/fonts
curl -L -o src/lib/pdf/fonts/Sarabun-Regular.ttf https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Regular.ttf
curl -L -o src/lib/pdf/fonts/Sarabun-Bold.ttf    https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Bold.ttf
```
Verify both files are non-empty TTFs:
```bash
ls -l src/lib/pdf/fonts/*.ttf   # each should be tens of KB
file src/lib/pdf/fonts/Sarabun-Regular.ttf  # "TrueType Font data" (or similar)
```
If `curl`/network is unavailable, STOP and report BLOCKED (the fonts must be real TTFs — do not create empty placeholders).

- [ ] **Step 3: Trace the fonts into the serverless bundle**

Read `next.config.ts`. Add `outputFileTracingIncludes` so the PDF route ships the fonts on Vercel:
```ts
const nextConfig: NextConfig = {
  // ...existing config...
  outputFileTracingIncludes: {
    "/(app)/quotations/[id]/pdf": ["./src/lib/pdf/fonts/**"],
  },
};
```
(Merge into the existing config object; keep all current settings.)

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: PASS — compiles clean (the dep/fonts are unused so far).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/pdf/fonts/Sarabun-Regular.ttf src/lib/pdf/fonts/Sarabun-Bold.ttf next.config.ts
git commit -m "build: add @react-pdf/renderer + embed Sarabun fonts for quotation PDF"
```

---

### Task 2: Migration `0005` — quotation/customer document fields

**Files:**
- Create: `supabase/migrations/0005_quotation_pdf_fields.sql`

**Interfaces:**
- Produces (DB columns later tasks read/write): `quotation_items.model text`, `quotation_items.uom text`, `quotation_items.category text`; `quotations.validity_days integer not null default 30`, `quotations.payment_terms jsonb`; `customers.address text`.

- [ ] **Step 1: Create the migration file**

```sql
-- 0005_quotation_pdf_fields.sql
-- Additive fields for the "ESTIMATED PRICE" quotation document. All nullable or
-- defaulted, so existing rows are unaffected. No RLS change (columns inherit the
-- existing table policies).

alter table public.quotation_items
  add column if not exists model    text,
  add column if not exists uom      text,
  add column if not exists category text;

alter table public.quotations
  add column if not exists validity_days integer not null default 30,
  add column if not exists payment_terms jsonb;

alter table public.customers
  add column if not exists address text;
```

- [ ] **Step 2: Sanity-check the SQL**

Run: `grep -c "add column if not exists" supabase/migrations/0005_quotation_pdf_fields.sql`
Expected: `6`.
(Applying `0005` to the remote Supabase project is an ops step performed with DB credentials outside this task — see the plan's rollout note. The app builds and runs without it via the Supabase-not-configured fallback.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0005_quotation_pdf_fields.sql
git commit -m "feat(db): migration 0005 — quotation model/uom/category, validity, payment_terms, customer address"
```

---

### Task 3: Pure model — `formatMoney2` + `quotationPdfModel.ts` (TDD)

**Files:**
- Modify: `src/lib/money.ts`
- Create: `src/lib/quotationPdfModel.ts`
- Test: `src/lib/__tests__/lib.test.ts` (append)

**Interfaces:**
- Produces: `formatMoney2(satang: number): string` in `src/lib/money.ts`.
- Produces in `src/lib/quotationPdfModel.ts`:
  - `interface QuotationPaymentTerm { percent: number; condition: string }`
  - `interface PdfItemInput { line_no: number; model: string | null; description: string; category: string | null; qty: number; uom: string | null; unit_price: number; amount: number }`
  - `type PdfTableRow = { kind: "subheader"; category: string } | { kind: "item"; no: number; model: string; description: string; qty: number; uom: string; unitPrice: number; amount: number }`
  - `groupLinesByCategory(items: PdfItemInput[]): PdfTableRow[]`
  - `paymentRowAmount(totalSatang: number, percent: number): number`
  - `pdfFilename(quoteNumber: string | null): string`

- [ ] **Step 1: Write the failing tests**

Append the import with the others at the top of `src/lib/__tests__/lib.test.ts`:
```ts
import { formatMoney2 } from "../money";
import {
  groupLinesByCategory,
  paymentRowAmount,
  pdfFilename,
} from "../quotationPdfModel";
```
Append the tests at the end:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find `formatMoney2` / module `../quotationPdfModel`.

- [ ] **Step 3: Add `formatMoney2` to `src/lib/money.ts`**

Append:
```ts
/** Satang → baht string with grouped thousands and exactly 2 decimals, no ฿.
 *  For the quotation PDF (the app UI uses formatBaht). */
export function formatMoney2(satang: number): string {
  const baht = (satang || 0) / 100;
  return baht.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
```

- [ ] **Step 4: Create `src/lib/quotationPdfModel.ts`**

```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 4 new tests green (existing suite unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/lib/money.ts src/lib/quotationPdfModel.ts src/lib/__tests__/lib.test.ts
git commit -m "feat(quotations): pure PDF model — formatMoney2, groupLinesByCategory, payment/filename helpers"
```

---

### Task 4: Seller config — `src/lib/company.ts`

**Files:**
- Create: `src/lib/company.ts`

**Interfaces:**
- Produces: `COMPANY` constant with `legalName`, `headOfficeNote`, `address`, `tel`, `fax`, `cellPhone`, `logoPath`, `signatory { name, title }`, `introLine`, `legalLine`, `defaultPaymentTerm` (a `QuotationPaymentTerm`).

- [ ] **Step 1: Create `src/lib/company.ts`**

```ts
import type { QuotationPaymentTerm } from "./quotationPdfModel";

/** Fixed seller identity for the quotation document. Values transcribed verbatim
 *  from the corporate template (Q-MPT-…). The template shows no Tax ID, so none
 *  is included (do not fabricate). */
export const COMPANY = {
  legalName: "MATCHPOINT TECHNOLOGY CO.,LTD.",
  headOfficeNote: "(Head Office)",
  address:
    "1917 moo10, Soi Baring 36, Sukhumvit 107 Road, Samrongnua, Muangsamutprakarn, Samutprakarn 10270",
  tel: "02-743-2533",
  fax: "02-743-2533#101",
  cellPhone: "086-3183065",
  /** Path under /public for the header logo (add the asset when available). */
  logoPath: "/quotation/logo.png",
  signatory: { name: "Gunyarat Choksuntasut", title: "MANAGER" },
  introLine:
    "According to your requirements we are truly pleased to submit the following offer for your kind consideration",
  legalLine:
    "By signing below, the client has approved and accepted the above terms and conditions of this quotation with fully understanding and acceptance that this document can legally be used as a purchase Order.",
  defaultPaymentTerm: {
    percent: 100,
    condition: "Against Purchase Order (for stock goods)",
  } as QuotationPaymentTerm,
} as const;
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/company.ts
git commit -m "feat(quotations): seller/company config constant for the PDF document"
```

---

### Task 5: `getQuotationForPdf` loader

**Files:**
- Modify: `src/lib/quotations.ts`

**Interfaces:**
- Consumes: `QuotationPaymentTerm`, `PdfItemInput` (Task 3), `COMPANY` (Task 4).
- Produces: `interface QuotationPdfData { number: string | null; quotationDate: string; validityDays: number; vatRatePct: number; subtotal: number; vatAmount: number; total: number; remark: string | null; paymentTerms: QuotationPaymentTerm[]; salesPerson: string | null; items: PdfItemInput[]; customer: { name: string; address: string | null; province: string | null; taxId: string | null; contactName: string | null; contactTitle: string | null; contactPhone: string | null; contactEmail: string | null } }`
- Produces: `getQuotationForPdf(id: string): Promise<QuotationPdfData | null>`

- [ ] **Step 1: Add the loader to `src/lib/quotations.ts`**

Add imports at the top:
```ts
import { getVatRatePct } from "./config";
import type { PdfItemInput, QuotationPaymentTerm } from "./quotationPdfModel";
import { COMPANY } from "./company";
```
Append:
```ts
export interface QuotationPdfData {
  number: string | null;
  quotationDate: string;
  validityDays: number;
  vatRatePct: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  remark: string | null;
  paymentTerms: QuotationPaymentTerm[];
  salesPerson: string | null;
  items: PdfItemInput[];
  customer: {
    name: string;
    address: string | null;
    province: string | null;
    taxId: string | null;
    contactName: string | null;
    contactTitle: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
  };
}

export async function getQuotationForPdf(
  id: string
): Promise<QuotationPdfData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(
      `number, quotation_date, validity_days, vat_amount, subtotal, total, remark, payment_terms,
       created_by,
       creator:profiles!quotations_created_by_fkey(full_name),
       customers(name, address, province, tax_id,
         contacts(name, title, phone, email, is_primary)),
       quotation_items(line_no, model, description, category, qty, uom, unit_price, amount)`
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as {
    number: string | null;
    quotation_date: string;
    validity_days: number | null;
    vat_amount: number;
    subtotal: number;
    total: number;
    remark: string | null;
    payment_terms: QuotationPaymentTerm[] | null;
    creator: { full_name: string | null } | null;
    customers: {
      name: string;
      address: string | null;
      province: string | null;
      tax_id: string | null;
      contacts: {
        name: string;
        title: string | null;
        phone: string | null;
        email: string | null;
        is_primary: boolean;
      }[];
    } | null;
    quotation_items: PdfItemInput[];
  };

  const contact =
    row.customers?.contacts?.find((c) => c.is_primary) ??
    row.customers?.contacts?.[0] ??
    null;

  const paymentTerms =
    Array.isArray(row.payment_terms) && row.payment_terms.length > 0
      ? row.payment_terms
      : [COMPANY.defaultPaymentTerm];

  return {
    number: row.number,
    quotationDate: row.quotation_date,
    validityDays: row.validity_days ?? 30,
    vatRatePct: await getVatRatePct(),
    subtotal: row.subtotal,
    vatAmount: row.vat_amount,
    total: row.total,
    remark: row.remark,
    paymentTerms,
    salesPerson: row.creator?.full_name ?? null,
    items: [...(row.quotation_items ?? [])].sort((a, b) => a.line_no - b.line_no),
    customer: {
      name: row.customers?.name ?? "",
      address: row.customers?.address ?? null,
      province: row.customers?.province ?? null,
      taxId: row.customers?.tax_id ?? null,
      contactName: contact?.name ?? null,
      contactTitle: contact?.title ?? null,
      contactPhone: contact?.phone ?? null,
      contactEmail: contact?.email ?? null,
    },
  };
}
```

Note: if the `profiles` table's display column is not `full_name`, adjust the `creator:profiles(...)` selection and the `full_name` reads to the actual column (check `src/lib/users.ts` / the profiles schema). Keep the returned `salesPerson` shape unchanged.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/quotations.ts
git commit -m "feat(quotations): getQuotationForPdf loader (header, items, customer, contact)"
```

---

### Task 6: `QuotationPdf` document component

**Files:**
- Create: `src/lib/pdf/QuotationPdf.tsx`

**Interfaces:**
- Consumes: `QuotationPdfData` (Task 5), `COMPANY` (Task 4), `formatMoney2` (Task 3), `groupLinesByCategory`/`paymentRowAmount` (Task 3), the Sarabun TTFs (Task 1).
- Produces: `QuotationPdf(props: { data: QuotationPdfData }): JSX.Element` (a `@react-pdf/renderer` `<Document>`), default-exported too.

- [ ] **Step 1: Create `src/lib/pdf/QuotationPdf.tsx`**

```tsx
import path from "node:path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";
import { formatMoney2 } from "@/lib/money";
import {
  groupLinesByCategory,
  paymentRowAmount,
} from "@/lib/quotationPdfModel";
import type { QuotationPdfData } from "@/lib/quotations";

Font.register({
  family: "Sarabun",
  fonts: [
    { src: path.join(process.cwd(), "src/lib/pdf/fonts/Sarabun-Regular.ttf") },
    {
      src: path.join(process.cwd(), "src/lib/pdf/fonts/Sarabun-Bold.ttf"),
      fontWeight: "bold",
    },
  ],
});

const C = { line: "#334155", soft: "#e2e8f0", muted: "#64748b" };

const s = StyleSheet.create({
  page: { fontFamily: "Sarabun", fontSize: 8, color: "#111827", padding: 28 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  company: { fontSize: 9, fontWeight: "bold" },
  companyLine: { fontSize: 7, color: C.muted },
  title: { textAlign: "center", fontSize: 14, fontWeight: "bold", marginVertical: 8 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  infoCol: { width: "48%" },
  infoLine: { flexDirection: "row", marginBottom: 1 },
  infoLabel: { width: 60, color: C.muted },
  infoValue: { flex: 1 },
  intro: { marginBottom: 4 },
  th: { flexDirection: "row", backgroundColor: "#f1f5f9", borderTop: 1, borderBottom: 1, borderColor: C.line, fontWeight: "bold" },
  tr: { flexDirection: "row", borderBottom: 1, borderColor: C.soft },
  subheader: { flexDirection: "row", backgroundColor: "#f8fafc", borderBottom: 1, borderColor: C.soft },
  cNo: { width: "6%", padding: 3 },
  cModel: { width: "16%", padding: 3 },
  cDesc: { width: "38%", padding: 3 },
  cQty: { width: "8%", padding: 3, textAlign: "right" },
  cUom: { width: "8%", padding: 3 },
  cUnit: { width: "12%", padding: 3, textAlign: "right" },
  cTotal: { width: "12%", padding: 3, textAlign: "right" },
  totals: { alignSelf: "flex-end", width: "40%", marginTop: 6 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1 },
  grand: { borderTop: 1, borderColor: C.line, fontWeight: "bold", marginTop: 2, paddingTop: 2 },
  remark: { marginTop: 8 },
  payTitle: { marginTop: 8, fontWeight: "bold" },
  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 28 },
  signCol: { width: "48%" },
  signLabel: { fontWeight: "bold", marginBottom: 4 },
  legal: { marginTop: 16, fontSize: 7, color: C.muted },
});

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoLine}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value || "—"}</Text>
    </View>
  );
}

export function QuotationPdf({ data }: { data: QuotationPdfData }) {
  const rows = groupLinesByCategory(data.items);
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.company}>{COMPANY.legalName} {COMPANY.headOfficeNote}</Text>
            <Text style={s.companyLine}>{COMPANY.address}</Text>
            <Text style={s.companyLine}>T: {COMPANY.tel}, {COMPANY.cellPhone}  FAX: {COMPANY.fax}</Text>
          </View>
        </View>

        <Text style={s.title}>ESTIMATED PRICE</Text>

        {/* Client + meta */}
        <View style={s.infoRow}>
          <View style={s.infoCol}>
            <Info label="Client:" value={data.customer.name} />
            <Info label="Address:" value={data.customer.address ?? data.customer.province ?? ""} />
            <Info label="Attention:" value={data.customer.contactName ?? ""} />
            <Info label="Title:" value={data.customer.contactTitle ?? ""} />
            <Info label="Tel:" value={data.customer.contactPhone ?? ""} />
            <Info label="Email:" value={data.customer.contactEmail ?? ""} />
          </View>
          <View style={s.infoCol}>
            <Info label="Quote No:" value={data.number ?? "—"} />
            <Info label="Date:" value={fmtDate(data.quotationDate)} />
            <Info label="Validity:" value={`${data.validityDays} days`} />
            <Info label="Sales Person:" value={data.salesPerson ?? ""} />
            <Info label="Cell Phone:" value={COMPANY.cellPhone} />
          </View>
        </View>

        <Text style={s.intro}>{COMPANY.introLine}</Text>

        {/* Solution table */}
        <View style={s.th}>
          <Text style={s.cNo}>No</Text>
          <Text style={s.cModel}>Model</Text>
          <Text style={s.cDesc}>Item Description</Text>
          <Text style={s.cQty}>QTY</Text>
          <Text style={s.cUom}>UOM</Text>
          <Text style={s.cUnit}>Unit Price</Text>
          <Text style={s.cTotal}>Total (THB)</Text>
        </View>
        {rows.map((r, i) =>
          r.kind === "subheader" ? (
            <View key={`h${i}`} style={s.subheader}>
              <Text style={{ padding: 3, fontWeight: "bold" }}>{r.category}</Text>
            </View>
          ) : (
            <View key={`r${i}`} style={s.tr}>
              <Text style={s.cNo}>{r.no}</Text>
              <Text style={s.cModel}>{r.model}</Text>
              <Text style={s.cDesc}>{r.description}</Text>
              <Text style={s.cQty}>{r.qty}</Text>
              <Text style={s.cUom}>{r.uom}</Text>
              <Text style={s.cUnit}>{formatMoney2(r.unitPrice)}</Text>
              <Text style={s.cTotal}>{formatMoney2(r.amount)}</Text>
            </View>
          )
        )}

        {/* Totals */}
        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text>Subtotal</Text>
            <Text>{formatMoney2(data.subtotal)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text>VAT {data.vatRatePct}%</Text>
            <Text>{formatMoney2(data.vatAmount)}</Text>
          </View>
          <View style={[s.totalRow, s.grand]}>
            <Text>Grand Total (THB)</Text>
            <Text>{formatMoney2(data.total)}</Text>
          </View>
        </View>

        {/* Remark */}
        {data.remark ? <Text style={s.remark}>Remark: {data.remark}</Text> : null}

        {/* Payment terms */}
        <Text style={s.payTitle}>Term of payment</Text>
        <View style={s.th}>
          <Text style={{ width: "15%", padding: 3 }}>%</Text>
          <Text style={{ width: "25%", padding: 3, textAlign: "right" }}>Amount (THB)</Text>
          <Text style={{ width: "60%", padding: 3 }}>Condition/Deliverables</Text>
        </View>
        {data.paymentTerms.map((p, i) => (
          <View key={`p${i}`} style={s.tr}>
            <Text style={{ width: "15%", padding: 3 }}>{p.percent}%</Text>
            <Text style={{ width: "25%", padding: 3, textAlign: "right" }}>
              {formatMoney2(paymentRowAmount(data.total, p.percent))}
            </Text>
            <Text style={{ width: "60%", padding: 3 }}>{p.condition}</Text>
          </View>
        ))}

        {/* Signatures */}
        <View style={s.signRow}>
          <View style={s.signCol}>
            <Text style={s.signLabel}>Service Provider</Text>
            <Text>Company: {COMPANY.legalName}</Text>
            <Text>Authorizer: {COMPANY.signatory.name}</Text>
            <Text>Title: {COMPANY.signatory.title}</Text>
            <Text>Date: {fmtDate(data.quotationDate)}</Text>
            <Text>Signature: ____________________</Text>
          </View>
          <View style={s.signCol}>
            <Text style={s.signLabel}>Client</Text>
            <Text>Company: ____________________</Text>
            <Text>Authorizer: ____________________</Text>
            <Text>Title: ____________________</Text>
            <Text>Date: ____________________</Text>
            <Text>Signature: ____________________</Text>
          </View>
        </View>

        <Text style={s.legal}>{COMPANY.legalLine}</Text>
      </Page>
    </Document>
  );
}

export default QuotationPdf;
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS (component is imported by the route in the next task; unused now is fine).

- [ ] **Step 3: Commit**

```bash
git add src/lib/pdf/QuotationPdf.tsx
git commit -m "feat(quotations): ESTIMATED PRICE PDF document component (@react-pdf/renderer)"
```

---

### Task 7: PDF route + smoke test

**Files:**
- Create: `src/app/(app)/quotations/[id]/pdf/route.ts`
- Create: `src/lib/pdf/__tests__/render-smoke.ts`

**Interfaces:**
- Consumes: `getCurrentUser` (`@/lib/auth`), `getQuotationForPdf` (Task 5), `QuotationPdf` (Task 6), `pdfFilename` (Task 3), `@react-pdf/renderer` `renderToBuffer`.

- [ ] **Step 1: Write the smoke test (renders to a PDF buffer, no DB)**

Create `src/lib/pdf/__tests__/render-smoke.ts`:
```ts
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
```
Note: this test file is `.tsx`-style JSX in a `.ts` file — rename it to `render-smoke.tsx` so the tsx loader parses the JSX. Use that name in the commands below.

- [ ] **Step 2: Run the smoke test to verify it fails**

Run: `node --import tsx --test src/lib/pdf/__tests__/render-smoke.tsx`
Expected: FAIL — `QuotationPdf` import resolves but the route/module wiring is incomplete, or (before Task 6 is present in the branch) module-not-found. If Task 6 is already committed, the expected first failure is instead a font/register error only if fonts are missing — fonts were added in Task 1, so this should actually PASS once the component exists. Treat a PASS here as success (the smoke test has no prior failing state to assert beyond module resolution).

- [ ] **Step 3: Create the route `src/app/(app)/quotations/[id]/pdf/route.ts`**

```ts
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth";
import { getQuotationForPdf } from "@/lib/quotations";
import { pdfFilename } from "@/lib/quotationPdfModel";
import { QuotationPdf } from "@/lib/pdf/QuotationPdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const data = await getQuotationForPdf(id);
  if (!data) return new Response("Not found", { status: 404 });

  const buffer = await renderToBuffer(<QuotationPdf data={data} />);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFilename(data.number)}"`,
      "Cache-Control": "no-store",
    },
  });
}
```
(This route uses JSX, so the file must be `route.tsx`. Create it as `src/app/(app)/quotations/[id]/pdf/route.tsx`.)

- [ ] **Step 4: Verify build + tests**

Run: `npm run build && node --import tsx --test src/lib/pdf/__tests__/render-smoke.tsx`
Expected: PASS — clean build; smoke test asserts a `%PDF-` buffer.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/quotations/[id]/pdf/route.tsx" src/lib/pdf/__tests__/render-smoke.tsx
git commit -m "feat(quotations): GET /quotations/[id]/pdf streams the ESTIMATED PRICE PDF"
```

---

### Task 8: Capture new fields in `QuotationForm` + `createQuotation`

**Files:**
- Modify: `src/components/quotations/QuotationForm.tsx`
- Modify: `src/app/(app)/quotations/actions.ts`

**Interfaces:**
- Consumes: existing form patterns (`lines` state, hidden inputs, `createQuotation`).
- Produces: persisted `quotation_items.model/uom/category`, `quotations.validity_days`, `quotations.payment_terms`.

- [ ] **Step 1: Extend the form's line model + new state**

In `QuotationForm.tsx`, extend the `Line` interface and `EMPTY_LINE`:
```ts
interface Line {
  description: string;
  model: string;
  uom: string;
  category: string;
  unit_price: string;
  qty: string;
  discount_pct: string;
}
const EMPTY_LINE: Line = { description: "", model: "", uom: "", category: "", unit_price: "", qty: "1", discount_pct: "0" };
```
Add state near the other `useState`s:
```ts
const [validityDays, setValidityDays] = useState("30");
const [paymentTerms, setPaymentTerms] = useState<{ percent: string; condition: string }[]>([
  { percent: "100", condition: "Against Purchase Order (for stock goods)" },
]);
```

- [ ] **Step 2: Add hidden inputs for the new quotation-level fields**

Next to the existing hidden inputs, add:
```tsx
<input type="hidden" name="validity_days" value={validityDays} />
<input type="hidden" name="payment_terms" value={JSON.stringify(paymentTerms)} />
```

- [ ] **Step 3: Add Model / UOM / Category inputs to each line row + a Validity field + a Payment-terms editor**

For each line row, add three inputs bound to `model`, `uom`, `category` via the existing `updateLine(i, { ... })` helper, e.g.:
```tsx
<input value={l.model} onChange={(e) => updateLine(i, { model: e.target.value })} className="input" placeholder={t("model")} />
<input value={l.uom} onChange={(e) => updateLine(i, { uom: e.target.value })} className="input" placeholder={t("uom")} />
<input value={l.category} onChange={(e) => updateLine(i, { category: e.target.value })} className="input" placeholder={t("category")} />
```
Place them within the line-item block (extend the row grid to include them). Add a Validity field in the meta row:
```tsx
<label className="flex flex-col gap-1">
  <span className="text-xs font-semibold text-gray-600">{t("validityDays")}</span>
  <input type="number" min={1} value={validityDays} onChange={(e) => setValidityDays(e.target.value)} className="input" />
</label>
```
Add a small Payment-terms editor (rows of percent + condition) below the totals:
```tsx
<div className="flex flex-col gap-2">
  <div className="text-xs font-bold text-gray-600">{t("paymentTerms")}</div>
  {paymentTerms.map((p, i) => (
    <div key={i} className="flex gap-2">
      <input type="number" min={0} max={100} value={p.percent}
        onChange={(e) => setPaymentTerms((prev) => prev.map((r, idx) => idx === i ? { ...r, percent: e.target.value } : r))}
        className="input w-20" placeholder="%" />
      <input value={p.condition}
        onChange={(e) => setPaymentTerms((prev) => prev.map((r, idx) => idx === i ? { ...r, condition: e.target.value } : r))}
        className="input flex-1" placeholder={t("paymentCondition")} />
      <Button type="button" variant="ghost" onClick={() => setPaymentTerms((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)}>
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  ))}
  <Button type="button" variant="ghost" onClick={() => setPaymentTerms((prev) => [...prev, { percent: "0", condition: "" }])}>
    <Plus className="h-3.5 w-3.5" aria-hidden /> {t("addPaymentTerm")}
  </Button>
</div>
```
Add the referenced i18n keys (`model`, `uom`, `category`, `validityDays`, `paymentTerms`, `paymentCondition`, `addPaymentTerm`) under `quotations.form` in BOTH `messages/th.json` and `messages/en.json`.

- [ ] **Step 4: Persist the new fields in `createQuotation`**

In `src/app/(app)/quotations/actions.ts`, extend `RawLine` and the insert:
```ts
interface RawLine {
  description: string;
  model?: string;
  uom?: string;
  category?: string;
  unit_price: string;
  qty: string;
  discount_pct: string;
}
```
When mapping `lines`, carry `model`, `uom`, `category` through to the `QuotationLineInput` (extend that type in `@/lib/quotation` with optional `model?: string | null; uom?: string | null; category?: string | null`). On the `quotations` insert, add:
```ts
validity_days: Number(formData.get("validity_days") ?? 30) || 30,
payment_terms: (() => {
  try {
    const raw = JSON.parse(String(formData.get("payment_terms") ?? "[]")) as { percent: string; condition: string }[];
    return raw
      .filter((p) => p.condition?.trim())
      .map((p) => ({ percent: Number(p.percent) || 0, condition: p.condition.trim() }));
  } catch {
    return [];
  }
})(),
```
On the `quotation_items` insert, add `model: l.model ?? null, uom: l.uom ?? null, category: l.category ?? null` to each item object.

- [ ] **Step 5: Verify build + tests**

Run: `npm run build && npm test`
Expected: PASS — clean build; existing + Task-3 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/components/quotations/QuotationForm.tsx "src/app/(app)/quotations/actions.ts" src/lib/quotation.ts messages/th.json messages/en.json
git commit -m "feat(quotations): capture model/uom/category, validity, payment terms in the form"
```

---

### Task 9: Customer address field

**Files:**
- Modify: `src/components/customers/CustomerForm.tsx`
- Modify: the customers server action that inserts/updates a customer (find it via `createCustomer`/`updateCustomer` in `src/app/(app)/customers/actions.ts`) and the `CustomerInput` type in `src/lib/types.ts`.

- [ ] **Step 1: Add `address` to the customer input type**

In `src/lib/types.ts`, add `address: string | null;` to `CustomerInput` (and to `Customer` if the interface is used to read it back).

- [ ] **Step 2: Add an Address input to `CustomerForm`**

Add a text input `name="address"` (a textarea is fine) near the province field, defaulted from `initial?.address`, with a label using an `address` i18n key added under `customers.form` in both message files.

- [ ] **Step 3: Persist `address` in the customer action**

In the customers action, read `String(formData.get("address") ?? "") || null` and include `address` in the insert/update payload.

- [ ] **Step 4: Verify build + tests**

Run: `npm run build && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/customers/CustomerForm.tsx "src/app/(app)/customers/actions.ts" src/lib/types.ts messages/th.json messages/en.json
git commit -m "feat(customers): capture street address (used by the quotation document)"
```

---

### Task 10: Download button on the quotations list

**Files:**
- Modify: `src/app/(app)/quotations/page.tsx`

- [ ] **Step 1: Add a Download link to each quotation row**

In the row markup of `src/app/(app)/quotations/page.tsx`, add a Download control per row (the list already has each row's `id`). Use a plain anchor styled as a subtle button so no client JS is needed:
```tsx
<a
  href={`/quotations/${q.id}/pdf`}
  download
  className="inline-flex items-center gap-1 rounded-md border border-[var(--color-line)] px-2 py-1 text-xs font-semibold text-[var(--color-primary)] hover:bg-blue-50"
  aria-label={t("download")}
>
  <Download className="h-3.5 w-3.5" aria-hidden />
  {t("download")}
</a>
```
Import `Download` from `lucide-react`. Add a `download` key under `quotations` in both message files. Ensure the row still links to nothing conflicting (the anchor is an isolated control; if the whole row is a link, place the download anchor so its click doesn't also trigger row navigation — e.g. `onClick` stopPropagation is not available in a server component, so render the download anchor outside any wrapping row-level `<Link>`).

- [ ] **Step 2: Verify build + tests**

Run: `npm run build && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/quotations/page.tsx" messages/th.json messages/en.json
git commit -m "feat(quotations): Download PDF action on each list row"
```

---

### Task 11: Manual QA (no deploy, no remote migration by the implementer)

**Files:** none (verification only).

- [ ] **Step 1: Build + all tests**

Run: `npm run build && npm test && node --import tsx --test src/lib/pdf/__tests__/render-smoke.tsx`
Expected: PASS — clean build; unit suite green; smoke test emits a `%PDF-` buffer.

- [ ] **Step 2: Manual QA (deferred if no local Supabase env + seed, as in sub-projects B/C)**

Prerequisite ops steps (performed by a human with credentials, NOT this task): apply `supabase/migrations/0005_quotation_pdf_fields.sql` to the remote project; add the header logo at `public/quotation/logo.png`. Then, with Supabase env + seed:
- Create a quotation with several line items across 2–3 categories (e.g. "อุปกรณ์ RFID", "Software"), set Model/UOM on some, set Validity, and add a payment term.
- On `/quotations`, click **Download** on that row → a `<number>.pdf` downloads.
- Open the PDF and compare to the template: header (company/address/tel), centered **ESTIMATED PRICE**, Client + meta blocks, the solution table with category sub-headers + sequential No, Subtotal/VAT/Grand Total (2-decimal THB), Remark, Term-of-payment table, both signature blocks + the legal line. Confirm Thai text (customer name, category) renders (Sarabun).
- Confirm a signed-out request to `/quotations/<id>/pdf` returns 401 and a bad id returns 404.

- [ ] **Step 3: Record QA outcome**

Write results to `docs/superpowers/qa/2026-07-07-quotation-pdf-qa.md` (automated PASS details + any deferred interactive items + the pending ops steps: remote 0005, logo asset). Commit:
```bash
git add docs/superpowers/qa/2026-07-07-quotation-pdf-qa.md
git commit -m "docs: QA outcome for Quotation PDF download"
```

---

## Self-Review

**Spec coverage:**
- Download on list row → PDF file → Tasks 7, 10. ✓
- `@react-pdf/renderer`, Sarabun embedded, English labels → Tasks 1, 6. ✓
- Migration 0005 (model/uom/category, validity_days, payment_terms, customer address) → Task 2. ✓
- Form captures the new fields → Tasks 8 (quotation), 9 (customer address). ✓
- Seller config constant (real template values, no fabricated Tax ID) → Task 4. ✓
- `getQuotationForPdf` loader → Task 5. ✓
- `formatMoney2` (845,750.00, no ฿) + pure model helpers + tests → Task 3. ✓
- API route auth + 404 + attachment filename → Task 7. ✓
- Title "ESTIMATED PRICE" → Global Constraints + Task 6. ✓
- Testing: unit (helpers) + smoke render + manual QA; no deploy → Tasks 3, 7, 11. ✓
- No discount column; discount still in amount → Global Constraints + Task 6/8. ✓

**Placeholder scan:** Complete code/values throughout; seller values are the real transcribed template strings (not placeholders). Tasks 8–10 modify large existing files and give concrete snippets + exact i18n keys to add rather than full-file rewrites — acceptable because the surrounding files are established and each snippet is self-contained. Logo asset + remote migration are explicitly ops steps, not code placeholders.

**Type consistency:** `QuotationPaymentTerm`/`PdfItemInput`/`PdfTableRow` defined in Task 3 and consumed by Tasks 4/5/6. `QuotationPdfData` defined in Task 5 and consumed by Tasks 6/7 with matching field names (`quotationDate`, `validityDays`, `vatRatePct`, `salesPerson`, `items`, `customer.*`). `formatMoney2`/`groupLinesByCategory`/`paymentRowAmount`/`pdfFilename` names match across Tasks 3/6/7. `getQuotationForPdf` signature matches its call in Task 7. Route + component are `.tsx` (JSX) per Task 6/7 notes.
