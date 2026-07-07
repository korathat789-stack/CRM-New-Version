# Quotation PDF Download — Design Spec

**Date:** 2026-07-07
**Status:** Approved design → pending implementation plan
**Base:** independent feature (does NOT depend on sub-projects B/C). Branch
(planned): `claude/quotation-pdf`, split from the mainline
`claude/mpt-crm-master-prompt-55kvwo` (phases 1–8, A merged).

## Context

The `/quotations` module can create quotations (`QuotationForm`) and list them
(`listQuotations`), but there is no way to produce the customer-facing document.
The user provided the real corporate template
(`Q-MPT-6607001-RFID-set1.pdf`) — an English "ESTIMATED PRICE" document from
MatchPoint Technology. This feature adds a **Download** action on each quotation
row that generates a PDF faithful to that template, using
`@react-pdf/renderer` (server-side, Vercel-friendly, embeds Thai + Latin fonts).

The current quotation data model is missing several fields the template shows, so
this feature also extends the schema (additive migration `0005`) and the
`QuotationForm` to capture them.

Sub-project B's spec listed "No Export-PDF" as out of scope; this is the net-new
feature that delivers it.

## Goals

- A **Download** button on each `/quotations` row that returns a `.pdf` file
  matching the template layout, titled **"ESTIMATED PRICE"**.
- Capture the template's data (per-line Model / UOM / category, quote validity,
  payment terms, client address) so the document is complete.
- Fixed seller/company details + default signatory come from code config.
- English labels in the document (data — e.g. line descriptions — render as
  entered, Thai or English; fonts embed Sarabun + Latin).

## Non-goals

- No quotation **detail page**; the download works from the list row only.
- No Settings UI to edit company details (config constant only — YAGNI).
- No email/send-PDF, no invoice changes, no changes to sub-projects B/C.
- The PDF does **not** show a per-line discount column (template has none); the
  discount still feeds each line `amount` as today.

## Schema — migration `0005` (additive, all new columns nullable / defaulted)

Backward-compatible: only adds columns, existing rows keep working.

- `public.quotation_items`: add `model text`, `uom text`, `category text` (all
  nullable).
- `public.quotations`: add `validity_days integer not null default 30`, add
  `payment_terms jsonb` (nullable) — an array of `{ "percent": number,
  "condition": string }`.
- `public.customers`: add `address text` (nullable) — the client's street
  address for the document's Client block.

RLS: the new columns live on already-RLS-protected tables; no policy change
needed. **Rollout:** apply `0005` to the remote Supabase project (data present;
additive columns are safe). **Rollback:** drop the added columns.

## Data captured in the form

`QuotationForm` (`src/components/quotations/QuotationForm.tsx`) and
`createQuotation` (`src/app/(app)/quotations/actions.ts`):

- Each line item row gains **Model**, **UOM**, and **Category** inputs. Category
  is a free-text/select used only to render grouped sub-headers in the PDF.
- A **Validity (days)** number field (default 30).
- A **Payment terms** editor: rows of `percent` + `condition` (default one row
  `{ percent: 100, condition: "Against Purchase Order" }`). The amount per row is
  derived (`round(total * percent / 100)`), not stored.
- `createQuotation` persists the new item columns, `validity_days`, and
  `payment_terms` (JSON).

`CustomerForm` (`src/components/customers/CustomerForm.tsx`) and its action gain a
single **Address** field writing `customers.address`.

## Seller/company config

`src/lib/company.ts` — a typed constant:

```ts
export const COMPANY = {
  legalName: "MATCHPOINT TECHNOLOGY CO.,LTD",
  headOfficeNote: "(Head Office)",
  address: "1917 moo10, ... Samutprakarn 10270",
  taxId: "<tax id from template>",
  tel: "<tel>",
  cellPhone: "<cell>",
  logoPath: "public/quotation/logo.png",
  signatory: { name: "<default authorizer>", title: "MANAGER" },
} as const;
```

Logo asset lives under `/public/quotation/`. The signature line renders the
company + default signatory name/title with a blank line for a wet signature.
(Exact tax id / tel / authorizer name are transcribed from the template PDF at
implementation time — flagged `NEEDS_EVIDENCE` until then per repo rules.)

## Data flow & components

### `getQuotationForPdf(id)` — `src/lib/quotations.ts`
Server loader using the RLS-scoped Supabase server client. Returns a typed
`QuotationPdfData`: the quotation header (`number`, `quotation_date`,
`validity_days`, `vat_mode`, `subtotal`, `vat_amount`, `total`, `remark`,
`payment_terms`), its ordered `quotation_items` (line_no, model, description, qty,
uom, unit_price, amount), and the linked customer (`name`, `address`,
`province`, `tax_id`) with its primary contact (`name`, `title`, `phone`,
`email`). Returns `null` when not found / not permitted (RLS).

### `QuotationPdf` — `src/lib/pdf/QuotationPdf.tsx`
A `@react-pdf/renderer` `<Document>` mirroring the template, top to bottom:
1. Header band: logo (left) + company legal name / address / Tax ID / Tel (right).
2. Centered title **ESTIMATED PRICE**.
3. Two columns: **Client** block (Client name, Address, Attention = primary
   contact name, Title, Tel, Email) and **meta** block (Quote No, Date, page,
   Validity = `{validity_days} days`, Unit = "Baht", Cell Phone).
4. Intro line ("According to your requirements …").
5. Solution table, columns `No | Model | Item Description | QTY | UOM | Unit
   Price | Total (THB)`. A **category sub-header row** renders whenever an item's
   `category` differs from the previous item's (items ordered by `line_no`);
   empty category → no sub-header. Money uses the 2-decimal format.
6. Totals block: Subtotal / VAT 7% (labelled from the VAT rate) / **Grand Total
   (THB)**.
7. Remark.
8. Payment-terms table: `% | Amount (THB) | Condition/Deliverables`, amount
   derived from `total`.
9. Two signature blocks (Service Provider from `COMPANY`, Client blank) + the
   legal acceptance line.

Fonts: register **Sarabun** (Thai) and a Latin font (Inter, or the built-in
Helvetica for pure-ASCII labels) so mixed Thai/English data renders.

### API route — `src/app/(app)/quotations/[id]/pdf/route.ts`
`GET` handler: `getCurrentUser()` guard; `getQuotationForPdf(id)` (RLS) → 404 if
null; render with `@react-pdf/renderer` `renderToStream`/`renderToBuffer`; return
`Response` with `Content-Type: application/pdf` and
`Content-Disposition: attachment; filename="<number>.pdf"`.

### List download button — `src/app/(app)/quotations/page.tsx`
Each row gets a **Download** control (an `<a href="/quotations/{id}/pdf"
download>` styled as a button/icon). No client JS needed.

## Money formatting

Add `formatMoney2(satang: number): string` to `src/lib/money.ts` → grouped
thousands with exactly 2 decimals and **no ฿ symbol** (e.g. `845,750.00`),
matching the template; column headers carry the "THB" unit. Existing
`formatBaht` (with ฿, no decimals) is unchanged and still used in the app UI.

## Error handling & edge cases

- Route: unauthenticated → redirect/401; not found or RLS-denied → 404; render
  failure → 500 with a safe message (no data leak).
- Missing optional data (no primary contact, no address, empty category, null
  `payment_terms`) → the PDF omits/──dashes that field gracefully; a null
  `payment_terms` falls back to the default single 100% row.
- `validity_days` always present (default 30).

## Testing

- **Unit (pure, no DB), in `src/lib/__tests__/lib.test.ts`:**
  - `groupLinesByCategory(items)` — turns an ordered item list into render rows
    with sub-header markers at category changes (empty category → none).
  - `paymentRowAmount(total, percent)` — `round(total * percent / 100)`.
  - `formatMoney2` — grouping + exactly 2 decimals, no ฿, handles 0/negative.
  - `pdfFilename(number)` — safe filename from the quote number.
- **Build + type-check** clean (includes `@react-pdf/renderer` in the route).
- **Smoke:** render `QuotationPdf` with a fixed fixture to a buffer in a script
  and assert a non-empty `%PDF` header (no DB needed).
- **Manual QA (deferred if no local Supabase env, as in B/C):** create a
  quotation with Model/UOM/categories + payment terms, click Download, compare
  the PDF against the template (header, client/meta blocks, grouped table,
  totals, payment terms, signatures, Thai text renders).

## Dependencies

Add `@react-pdf/renderer` (+ its font handling). **Justification (CLAUDE.md rule
5):** it renders React → PDF in Node/serverless without a headless browser
(unlike Puppeteer), so it deploys cleanly on Vercel and embeds custom Thai fonts;
it is the standard library for programmatic PDF documents in React.

## Rollback

Feature is additive on its own branch. Code revert = `git revert` the branch;
DB revert = drop the columns added by `0005`. No destructive data changes.
