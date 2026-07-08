-- ============================================================================
-- MatchPoint CRM — work & revenue tracking (from the team's Y2026 sheet)
-- Run AFTER 0005. Adds: activity next-step linkage, opportunity follow-up date,
-- 2-axis customer classification (Project/General × End-user/Reseller) +
-- partner, and post-Won project fulfillment status.
-- ============================================================================

-- Activities: optional next step + linked quotation number (their col H).
alter table public.activities
  add column if not exists next_step      text,
  add column if not exists quotation_no   text;

-- Opportunities: a follow-up date drives reminders (their "Next Step" date).
alter table public.opportunities
  add column if not exists next_action_date date;

-- Customers: 2-axis classification matching the sheet's "ประเภท".
--   segment    = 'project' | 'general'   (โครงการ / ทั่วไป)
--   buyer_role = 'end_user' | 'reseller' (End-user / ขายต่อ)
alter table public.customers
  add column if not exists segment    text check (segment in ('project','general')),
  add column if not exists buyer_role text check (buyer_role in ('end_user','reseller')),
  add column if not exists partner_name text;

-- Projects: fulfillment status to track work AFTER Won
--   (POC → delivery → installation → closed), matching รอส่งของ / รอติดตั้ง / ปิด.
alter table public.projects
  add column if not exists fulfillment text
    check (fulfillment in ('pending','delivering','installing','closed'))
    default 'pending';
