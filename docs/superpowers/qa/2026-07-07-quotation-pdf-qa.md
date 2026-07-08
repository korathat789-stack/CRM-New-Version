# QA Outcome — Quotation PDF Download

**Feature:** Download an "ESTIMATED PRICE" PDF from each `/quotations` row, rendered with `@react-pdf/renderer` (Sarabun fonts embedded), plus the schema + form fields the template needs.
**Branch:** `claude/quotation-pdf`
**Date run:** 2026-07-08

## Automated verification — PASS

| Check | Command | Result |
| --- | --- | --- |
| Production build (includes TypeScript type-check) | `npm run build` | ✓ Compiled successfully; 20/20 static pages; route `/quotations/[id]/pdf` present |
| Unit suite | `npm test` | ✓ 22 tests pass, 0 fail |
| PDF render smoke test | `node --import tsx --test src/lib/pdf/__tests__/render-smoke.tsx` | ✓ 1 pass — asserts a `%PDF-` buffer > 1000 bytes, renders Thai (Sarabun) + category sub-headers |

Task-3 model tests included in the suite: `formatMoney2` (e.g. `845,750.00`, no ฿), `paymentRowAmount`, `pdfFilename`, `groupLinesByCategory`.

### Notes / deviations
- **JSX runtime:** `tsconfig.json` uses `"jsx": "preserve"`, so the standalone `tsx` runner defaults to the classic runtime. Added an esbuild automatic-runtime pragma (`@jsxRuntime automatic` / `@jsxImportSource react`) to `src/lib/pdf/QuotationPdf.tsx` and the smoke test so `renderToBuffer(<QuotationPdf/>)` works outside Next. Harmless under Next (already automatic). Without it, react-pdf silently produced a null document.
- **Lint:** `next lint` is not configured in this repo (it prompts to scaffold ESLint). Type-checking is covered by `npm run build`. No lint step was run.
- Money stays integer satang end-to-end; `formatMoney2` only formats at render.

## Deferred — interactive manual QA (needs Supabase env + seed)

Not run in this environment (no local Supabase creds/seed). To perform:
- Create a quotation with line items across 2–3 categories (e.g. "อุปกรณ์ RFID", "Software"), set Model/UOM on some lines, set Validity, add a payment term.
- On `/quotations`, click **Download** → a `<number>.pdf` downloads.
- Compare to the template: header (company/address/tel), centered **ESTIMATED PRICE**, Client + meta blocks, solution table with category sub-headers + sequential No, Subtotal/VAT/Grand Total (2-decimal THB), Remark, Term-of-payment table, both signature blocks + legal line. Confirm Thai text renders (Sarabun).
- Signed-out request to `/quotations/<id>/pdf` → 401; unknown id → 404.

## Pending ops steps (human, with credentials — NOT done by the implementer)

1. Apply `supabase/migrations/0005_quotation_pdf_fields.sql` to the remote Supabase project (additive columns: `quotation_items.model/uom/category`, `quotations.validity_days`, `quotations.payment_terms`, `customers.address`). Until applied, inserts referencing the new columns will fail on the remote DB.
2. Add the header logo asset at `public/quotation/logo.png` (referenced by `COMPANY.logoPath`; the document currently renders without an image).

## Rollback plan

- Feature is additive and isolated. Revert commits `e63c7ff..4704144` (Tasks 4–10) plus the earlier `32c75d4`/`71142d1`/`5475496` if fully backing out.
- Migration `0005` is additive-only (no drops, no RLS change); leaving the columns in place is safe even if the UI is reverted.
