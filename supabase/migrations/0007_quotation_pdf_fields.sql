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
