-- MatchPoint CRM — sample data (optional). Run AFTER 0002_mpt_crm_core.sql.
-- Money is integer satang (฿ × 100). owner_id is left null (no auth users in
-- a seed); assign owners later from Users & Roles.

do $$
declare
  t_project uuid;
  t_dealer  uuid;
  siam uuid; laem uuid; garment uuid; medi uuid; retail uuid;
begin
  select id into t_project from public.customer_types where code = 'project_end_user';
  select id into t_dealer  from public.customer_types where code = 'dealer';

  insert into public.customers (name, tax_id, type_id, province, annual_revenue, lifetime_revenue, source, industry)
  values ('Siam Logistics Park Co., Ltd.', '0105551023417', t_project, 'Samut Prakan', 840000000, 840000000, 'Referral', 'Logistics')
  returning id into siam;

  insert into public.customers (name, tax_id, type_id, province, annual_revenue, lifetime_revenue, source, industry)
  values ('Laem Chabang Port', '0105551099887', t_project, 'Chonburi', 920000000, 1500000000, 'Tender', 'Port')
  returning id into laem;

  insert into public.customers (name, tax_id, type_id, province, annual_revenue, lifetime_revenue, source, industry)
  values ('Thai Garment Mfg PCL', '0107536000111', t_project, 'Bangkok', 420000000, 780000000, 'Trade show', 'Manufacturing')
  returning id into garment;

  insert into public.customers (name, tax_id, type_id, province, annual_revenue, lifetime_revenue, source, industry)
  values ('MediTrace Hospital', '0993000123456', t_project, 'Nonthaburi', 185000000, 296000000, 'Inbound', 'Healthcare')
  returning id into medi;

  insert into public.customers (name, tax_id, type_id, province, annual_revenue, lifetime_revenue, source, industry)
  values ('RetailPro Barcode', '0105560004321', t_dealer, 'Bangkok', 8000000, 8000000, 'Referral', 'Retail')
  returning id into retail;

  -- Contacts
  insert into public.contacts (customer_id, name, title, phone, email, line_id, is_primary) values
    (siam, 'Khun Anan W.', 'Procurement Manager', '021234567', 'anan@siamlogistics.co.th', 'anan_w', true),
    (medi, 'Dr. Pim S.', 'Biomedical Lead', '029876543', 'pim@meditrace.co.th', null, true);

  -- Opportunities (open + closed) for KPI rollups
  insert into public.opportunities (customer_id, title, stage, value, next_step) values
    (siam, 'UHF gate readers — inbound dock', 'quotation', 285000000, 'Send revised BOQ'),
    (siam, 'Handheld UHF readers x25', 'poc', 150000000, 'Confirm on-site POC date'),
    (siam, 'Yard expansion — phase 2', 'inquiry', 0, 'Qualify scope'),
    (laem, 'Container yard RFID portal', 'presentation', 920000000, 'Schedule demo'),
    (garment, 'Garment WIP tracking — tunnel', 'presentation', 420000000, 'Read-rate study'),
    (medi, 'Wristband tag supply — annual', 'won', 185000000, null),
    (medi, 'Cold chain temperature tags', 'poc', 111000000, 'Validate temp range');

  -- Projects (Project Tracking) linked to customers
  insert into public.projects (customer_id, name, stage, value, cost, budget, due_date, est_date, progress) values
    (siam, 'UHF gate readers — inbound dock', 'quotation', 285000000, 195000000, 200000000, date '2026-07-15', date '2026-07-22', 20),
    (siam, 'Handheld UHF readers x25', 'poc', 150000000, 105000000, 105000000, date '2026-07-30', date '2026-08-02', 35),
    (laem, 'Container yard RFID portal', 'presentation', 920000000, 690000000, 700000000, date '2026-09-12', date '2026-09-30', 10),
    (medi, 'Wristband tag supply — annual', 'won', 185000000, 120000000, 120000000, date '2026-07-10', date '2026-07-10', 100);

  -- Activities (timeline)
  insert into public.activities (customer_id, type, summary, occurred_at) values
    (siam, 'Call', 'procurement — requested revised BOQ', now() - interval '5 days'),
    (siam, 'Presentation', 'read-rate results review', now() - interval '9 days'),
    (siam, 'Quotation', 'Q6906008 issued', now() - interval '11 days');

  -- Invoices (Accounting / Reports — real money; due dates relative to today)
  insert into public.invoices (number, customer_id, amount, received, due_date, status) values
    ('INV-6905533', medi,    185000000, 185000000, current_date - interval '20 days', 'paid'),
    ('INV-6906008', siam,    285000000, 100000000, current_date + interval '18 days', 'partial'),
    ('INV-6907221', laem,    540000000,         0, current_date + interval '24 days', 'sent'),
    ('INV-6904018', garment, 260000000,         0, current_date - interval '70 days', 'overdue');
end $$;
