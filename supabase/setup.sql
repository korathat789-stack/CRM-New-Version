-- ============================================================================
-- MatchPoint CRM — ONE-SHOT SETUP
--
-- Paste this ENTIRE file into the Supabase SQL Editor and run it once on a
-- fresh project. It builds the full schema + RLS and every migration in order
-- (0002 core → 0003 reports → 0004 stage gates → 0005 v1 fixes → 0006 revenue
-- tracking), then optionally seeds sample data.
--
-- Notes:
--  * The legacy demo migration 0001 is NOT needed — section 1 rebuilds the
--    customers table from scratch (drop ... if exists is safe to re-run).
--  * Safe to re-run the whole file (drop-if-exists / add-column-if-not-exists).
--  * To skip the sample data, delete everything below the "OPTIONAL SAMPLE
--    DATA" banner near the bottom before running.
--  * Prefer copying from the raw file (`cat supabase/setup.sql`), not a
--    rendered Git view, to avoid stray characters in the SQL editor.
-- ============================================================================


-- ############################################################################
-- # SECTION 1 · 0002_mpt_crm_core.sql
-- ############################################################################

-- ============================================================================
-- MatchPoint CRM (MPT-CRM) — core schema, config, codes & RLS
-- Run AFTER 0001_init.sql (it drops the demo customers table and rebuilds the
-- real model). On a brand-new project you can run this file alone.
--
-- Conventions:
--   * Money is INTEGER satang (bigint). 1 baht = 100 satang. No floats.
--   * Soft delete via deleted_at; rows are never hard-deleted by the app.
--   * created_at / updated_at on every table; updated_at kept fresh by trigger.
--   * Permissions: RLS is the source of truth (mirrored by server-action checks).
-- ============================================================================

create extension if not exists "pgcrypto";

-- Remove the demo customers table from 0001 (and its dependents) so we can
-- rebuild it with the full MatchPoint shape.
drop table if exists public.customers cascade;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'manager', 'sales');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.stage_code as enum
    ('inquiry','presentation','quotation','poc','negotiation','won','lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.grade_basis as enum ('annual','lifetime');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.quotation_status as enum
    ('draft','sent','partial','paid','overdue','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invoice_status as enum
    ('sent','partial','paid','overdue','cancelled');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Config / lookup tables (editable defaults, app reads these)
-- ---------------------------------------------------------------------------
create table if not exists public.app_config (
  id              boolean primary key default true check (id),  -- singleton row
  vat_rate_pct    integer not null default 7,
  grade_basis     public.grade_basis not null default 'annual',
  margin_green_min integer not null default 30,
  margin_amber_min integer not null default 20,
  updated_at      timestamptz not null default now()
);
insert into public.app_config (id) values (true) on conflict (id) do nothing;

create table if not exists public.customer_types (
  id        uuid primary key default gen_random_uuid(),
  code      text unique not null,
  label_en  text not null,
  label_th  text not null,
  sort      integer not null default 0
);
insert into public.customer_types (code, label_en, label_th, sort) values
  ('project_end_user', 'Project — End User', 'โครงการ — ผู้ใช้งาน', 1),
  ('dealer',           'Dealer',             'ตัวแทนจำหน่าย',       2),
  ('reseller',         'Reseller',           'ผู้ขายต่อ',           3),
  ('system_integrator','System Integrator',  'ผู้วางระบบ',          4)
on conflict (code) do nothing;

create table if not exists public.credit_terms (
  days integer primary key
);
insert into public.credit_terms (days) values (15),(30),(45),(60)
on conflict (days) do nothing;

create table if not exists public.opportunity_stages (
  code      public.stage_code primary key,
  label_en  text not null,
  label_th  text not null,
  color_token text not null,
  sort      integer not null,
  -- required-field rule set used by the stage-gate engine (Phase 7)
  gate_rules jsonb not null default '[]'::jsonb
);
insert into public.opportunity_stages (code, label_en, label_th, color_token, sort) values
  ('inquiry',      'Inquiry',      'สอบถาม',    'stage-inquiry',      1),
  ('presentation', 'Presentation', 'นำเสนอ',    'stage-presentation', 2),
  ('quotation',    'Quotation',    'ใบเสนอราคา','stage-quotation',    3),
  ('poc',          'POC',          'ทดสอบ',     'stage-poc',          4),
  ('negotiation',  'Negotiation',  'เจรจา',     'stage-negotiation',  5),
  ('won',          'Won',          'ปิดการขาย', 'stage-won',          6),
  ('lost',         'Lost',         'ไม่สำเร็จ',  'stage-lost',         7)
on conflict (code) do nothing;

create table if not exists public.grade_bands (
  basis      public.grade_basis not null,
  grade      text not null check (grade in ('A','B','C','D','F')),
  min_satang bigint not null,          -- inclusive lower bound
  primary key (basis, grade)
);
-- ฿ bands from wireframe frame G (same for both bases by default).
insert into public.grade_bands (basis, grade, min_satang) values
  ('annual','A', 500000000),('annual','B', 200000000),('annual','C', 50000000),('annual','D', 10000000),('annual','F', 0),
  ('lifetime','A', 500000000),('lifetime','B', 200000000),('lifetime','C', 50000000),('lifetime','D', 10000000),('lifetime','F', 0)
on conflict (basis, grade) do nothing;

-- Immutable grade function mirroring the DEFAULT bands (keep in sync with
-- lib/grade.ts). Used for generated columns so we can filter/index by grade.
create or replace function public.customer_grade(amount_satang bigint)
returns text language sql immutable as $$
  select case
    when coalesce(amount_satang,0) >= 500000000 then 'A'
    when coalesce(amount_satang,0) >= 200000000 then 'B'
    when coalesce(amount_satang,0) >=  50000000 then 'C'
    when coalesce(amount_satang,0) >=  10000000 then 'D'
    else 'F'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users) — role lives here
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text,
  email         text,
  role          public.user_role not null default 'sales',
  status        public.user_status not null default 'active',
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Role helper (security definer so RLS policies can read the caller's role
-- without recursing into profiles' own policies).
create or replace function public.current_user_role()
returns public.user_role language sql stable security definer
set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select public.current_user_role() = 'admin';
$$;

create or replace function public.is_manager_or_admin()
returns boolean language sql stable as $$
  select public.current_user_role() in ('manager','admin');
$$;

-- New auth users get a profile automatically (first user = admin).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_first boolean;
begin
  select count(*) = 0 into is_first from public.profiles;
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    case when is_first then 'admin'::public.user_role else 'sales'::public.user_role end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Code generators (immutable, padded). CUS-000001, OPP-000001, PRJ-1001, Q……
-- ---------------------------------------------------------------------------
create sequence if not exists public.customer_code_seq start 1;
create sequence if not exists public.opportunity_code_seq start 1;
create sequence if not exists public.project_code_seq start 1001;
create sequence if not exists public.quotation_no_seq start 1;
create sequence if not exists public.invoice_no_seq start 1;

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id                uuid primary key default gen_random_uuid(),
  code              text unique,                     -- CUS-000001 (immutable)
  name              text not null,
  tax_id            text check (tax_id is null or tax_id ~ '^[0-9]{13}$'),
  type_id           uuid references public.customer_types (id),
  province          text,
  owner_id          uuid references public.profiles (id),
  annual_revenue    bigint not null default 0,       -- satang
  lifetime_revenue  bigint not null default 0,       -- satang
  source            text,
  industry          text,
  notes             text,
  grade_annual   text generated always as (public.customer_grade(annual_revenue)) stored,
  grade_lifetime text generated always as (public.customer_grade(lifetime_revenue)) stored,
  deleted_at        timestamptz,
  created_by        uuid references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create or replace function public.set_customer_code()
returns trigger language plpgsql as $$
begin
  if new.code is null then
    new.code := 'CUS-' || lpad(nextval('public.customer_code_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;
drop trigger if exists customers_set_code on public.customers;
create trigger customers_set_code before insert on public.customers
  for each row execute function public.set_customer_code();
drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

create index if not exists customers_name_idx on public.customers (lower(name));
create index if not exists customers_owner_idx on public.customers (owner_id);
create index if not exists customers_tax_id_idx on public.customers (tax_id);
create index if not exists customers_deleted_idx on public.customers (deleted_at);

-- ---------------------------------------------------------------------------
-- Contacts (people at a customer)
-- ---------------------------------------------------------------------------
create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  name        text not null,
  title       text,
  phone       text,
  email       text,
  line_id     text,
  is_primary  boolean not null default false,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();
create index if not exists contacts_customer_idx on public.contacts (customer_id);

-- ---------------------------------------------------------------------------
-- Opportunities
-- ---------------------------------------------------------------------------
create table if not exists public.opportunities (
  id            uuid primary key default gen_random_uuid(),
  code          text unique,                          -- OPP-000001
  customer_id   uuid not null references public.customers (id),
  title         text not null,
  stage         public.stage_code not null default 'inquiry',
  value         bigint not null default 0,            -- satang
  owner_id      uuid references public.profiles (id),
  next_step     text,
  expected_close date,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create or replace function public.set_opportunity_code()
returns trigger language plpgsql as $$
begin
  if new.code is null then
    new.code := 'OPP-' || lpad(nextval('public.opportunity_code_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;
drop trigger if exists opportunities_set_code on public.opportunities;
create trigger opportunities_set_code before insert on public.opportunities
  for each row execute function public.set_opportunity_code();
drop trigger if exists opportunities_set_updated_at on public.opportunities;
create trigger opportunities_set_updated_at before update on public.opportunities
  for each row execute function public.set_updated_at();
create index if not exists opportunities_customer_idx on public.opportunities (customer_id);
create index if not exists opportunities_stage_idx on public.opportunities (stage);

-- ---------------------------------------------------------------------------
-- Projects (Project Tracking)
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id             uuid primary key default gen_random_uuid(),
  code           text unique,                         -- PRJ-1001
  customer_id    uuid not null references public.customers (id),
  opportunity_id uuid references public.opportunities (id),
  name           text not null,
  stage          public.stage_code not null default 'inquiry',
  value          bigint not null default 0,           -- satang
  cost           bigint not null default 0,           -- satang
  budget         bigint not null default 0,           -- satang
  due_date       date,
  est_date       date,
  owner_id       uuid references public.profiles (id),
  progress       integer not null default 0 check (progress between 0 and 100),
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create or replace function public.set_project_code()
returns trigger language plpgsql as $$
begin
  if new.code is null then
    new.code := 'PRJ-' || nextval('public.project_code_seq')::text;
  end if;
  return new;
end;
$$;
drop trigger if exists projects_set_code on public.projects;
create trigger projects_set_code before insert on public.projects
  for each row execute function public.set_project_code();
drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create index if not exists projects_customer_idx on public.projects (customer_id);

-- ---------------------------------------------------------------------------
-- Quotations + line items
-- ---------------------------------------------------------------------------
create table if not exists public.quotations (
  id             uuid primary key default gen_random_uuid(),
  number         text unique,                         -- Q……
  customer_id    uuid not null references public.customers (id),
  opportunity_id uuid references public.opportunities (id),
  quotation_date date not null default current_date,
  expiring_date  date,
  credit_term    integer references public.credit_terms (days),
  vat_mode       text not null default 'excluded' check (vat_mode in ('excluded','included')),
  subtotal       bigint not null default 0,           -- satang
  vat_amount     bigint not null default 0,           -- satang
  total          bigint not null default 0,           -- satang
  remark         text,
  terms          text,
  status         public.quotation_status not null default 'draft',
  sent_at        timestamptz,
  deleted_at     timestamptz,
  created_by     uuid references public.profiles (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create or replace function public.set_quotation_number()
returns trigger language plpgsql as $$
begin
  if new.number is null then
    new.number := 'Q' || to_char(now(), 'YY') || lpad(nextval('public.quotation_no_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;
drop trigger if exists quotations_set_number on public.quotations;
create trigger quotations_set_number before insert on public.quotations
  for each row execute function public.set_quotation_number();
drop trigger if exists quotations_set_updated_at on public.quotations;
create trigger quotations_set_updated_at before update on public.quotations
  for each row execute function public.set_updated_at();
create index if not exists quotations_customer_idx on public.quotations (customer_id);

create table if not exists public.quotation_items (
  id           uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  line_no      integer not null,
  description  text not null,
  unit_price   bigint not null default 0,             -- satang
  qty          numeric(12,2) not null default 1,
  discount_pct numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  amount       bigint not null default 0              -- satang: round(unit_price*qty*(1-discount_pct/100))
);
create index if not exists quotation_items_quotation_idx on public.quotation_items (quotation_id);

-- ---------------------------------------------------------------------------
-- Invoices (Accounting / Reports — real money)
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id           uuid primary key default gen_random_uuid(),
  number       text unique,
  quotation_id uuid references public.quotations (id),
  customer_id  uuid not null references public.customers (id),
  amount       bigint not null default 0,             -- satang
  received     bigint not null default 0,             -- satang
  due_date     date,
  issued_at    date not null default current_date,
  status       public.invoice_status not null default 'sent',
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();
create index if not exists invoices_customer_idx on public.invoices (customer_id);

-- ---------------------------------------------------------------------------
-- Activities (timeline) + audit log
-- ---------------------------------------------------------------------------
create table if not exists public.activities (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid references public.customers (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  type           text not null,        -- call | presentation | quotation | note | poc ...
  summary        text not null,
  occurred_at    timestamptz not null default now(),
  created_by     uuid references public.profiles (id),
  created_at     timestamptz not null default now()
);
create index if not exists activities_customer_idx on public.activities (customer_id, occurred_at desc);

create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     uuid,
  action     text not null,            -- insert | update | soft_delete | restore
  actor_id   uuid references public.profiles (id),
  diff       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_row_idx on public.audit_log (table_name, row_id);

-- ---------------------------------------------------------------------------
-- Privilege guards (defence-in-depth alongside RLS)
-- ---------------------------------------------------------------------------

-- A user may edit their own profile (e.g. name) but only an admin may change a
-- profile's role or status — blocks self-escalation to admin via the anon
-- client. Non-admin attempts to change those columns are silently ignored.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role
      or new.status is distinct from old.status)
     and not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- Soft delete (setting/clearing deleted_at) is a privileged action: only
-- manager/admin may do it. The broad UPDATE policy still allows normal edits,
-- but a Sales user cannot soft-delete a row by writing deleted_at directly.
create or replace function public.guard_soft_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.deleted_at is distinct from old.deleted_at)
     and not public.is_manager_or_admin() then
    raise exception 'Only a manager or admin may delete records';
  end if;
  return new;
end;
$$;
do $$
declare t text;
begin
  foreach t in array array['customers','contacts','opportunities','projects','quotations','invoices']
  loop
    execute format('drop trigger if exists %I_guard_soft_delete on public.%I', t, t);
    execute format('create trigger %I_guard_soft_delete before update on public.%I for each row execute function public.guard_soft_delete()', t, t);
  end loop;
end $$;

-- ============================================================================
-- Row Level Security
-- RLS is the source of truth. Server actions repeat these checks.
--   * authenticated users read/write operational data
--   * only manager/admin may DELETE (hard) rows; app uses soft-delete via UPDATE
--   * invoices (Accounting/Reports data) are hidden from Sales
--   * profiles + config writable by admin only
-- ============================================================================
alter table public.app_config          enable row level security;
alter table public.customer_types       enable row level security;
alter table public.credit_terms         enable row level security;
alter table public.opportunity_stages   enable row level security;
alter table public.grade_bands          enable row level security;
alter table public.profiles             enable row level security;
alter table public.customers            enable row level security;
alter table public.contacts             enable row level security;
alter table public.opportunities        enable row level security;
alter table public.projects             enable row level security;
alter table public.quotations           enable row level security;
alter table public.quotation_items      enable row level security;
alter table public.invoices             enable row level security;
alter table public.activities           enable row level security;
alter table public.audit_log            enable row level security;

-- Config / lookups: everyone authenticated reads; admin writes.
do $$
declare t text;
begin
  foreach t in array array['app_config','customer_types','credit_terms','opportunity_stages','grade_bands']
  loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_admin_write on public.%I', t, t);
    execute format('create policy %I_admin_write on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- Profiles: a user reads their own row; admin reads/writes all.
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Operational tables: authenticated read + insert + update; delete = manager/admin.
do $$
declare t text;
begin
  foreach t in array array['customers','contacts','opportunities','projects','quotations','quotation_items','activities']
  loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (true)', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (true) with check (true)', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (public.is_manager_or_admin())', t, t);
  end loop;
end $$;

-- Invoices: Accounting/Reports data — Sales cannot see it at all.
drop policy if exists invoices_read on public.invoices;
create policy invoices_read on public.invoices
  for select to authenticated using (public.is_manager_or_admin());
drop policy if exists invoices_write on public.invoices;
create policy invoices_write on public.invoices
  for all to authenticated using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());

-- Audit log: manager/admin read; inserts happen via security-definer paths.
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log
  for select to authenticated using (public.is_manager_or_admin());
drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log
  for insert to authenticated with check (true);

-- ############################################################################
-- # SECTION 2 · 0003_reports.sql
-- ############################################################################

-- ============================================================================
-- MatchPoint CRM — reports support
-- Adds the overall sales target to config and convenience aggregation views.
-- Run AFTER 0002_mpt_crm_core.sql. Report aggregation is done in the app
-- (lib/reports.ts) reading base tables; these views are provided as documented
-- SQL helpers and use security_invoker so underlying RLS still applies.
-- ============================================================================

alter table public.app_config
  add column if not exists sales_target bigint not null default 500000000; -- ฿5M

-- Open pipeline value by stage.
create or replace view public.report_pipeline_by_stage
  with (security_invoker = true) as
  select stage,
         coalesce(sum(value), 0)::bigint as value,
         count(*)::int as count
  from public.opportunities
  where deleted_at is null
    and stage in ('inquiry','presentation','quotation','poc','negotiation')
  group by stage;

-- Won value by owner.
create or replace view public.report_sales_by_owner
  with (security_invoker = true) as
  select o.owner_id,
         coalesce(p.full_name, 'Unassigned') as owner_name,
         coalesce(sum(o.value) filter (where o.stage = 'won'), 0)::bigint as won
  from public.opportunities o
  left join public.profiles p on p.id = o.owner_id
  where o.deleted_at is null
  group by o.owner_id, p.full_name;

-- Per-project value / cost / budget (Cost Budgeting + P&L source).
create or replace view public.report_project_costs
  with (security_invoker = true) as
  select id, name, stage, value, cost, budget, due_date
  from public.projects
  where deleted_at is null;

-- ############################################################################
-- # SECTION 3 · 0004_stage_gates.sql
-- ############################################################################

-- ============================================================================
-- MatchPoint CRM — sales workflow stage gates
-- Adds the opportunity fields the stage-gate engine reads (POC, sign-off,
-- signed quotation). Run AFTER 0002/0003. Gate RULES live in app code
-- (lib/gates.ts) shared by the completeness tracker and the gate modal.
-- ============================================================================

alter table public.opportunities
  add column if not exists poc_scheduled_at date,
  add column if not exists poc_result       text,
  add column if not exists signed_quote_url text,
  add column if not exists authorized_by    uuid references public.profiles (id),
  add column if not exists authorized_at    timestamptz;

-- ############################################################################
-- # SECTION 4 · 0005_v1_fixes.sql
-- ############################################################################

-- ============================================================================
-- MatchPoint CRM — v1.0 test feedback: address field + Tasks + sales targets
-- Run AFTER 0002/0003/0004.
-- ============================================================================

-- Customers gain a free-text address (shown on the add/edit form).
alter table public.customers add column if not exists address text;

-- ---------------------------------------------------------------------------
-- Tasks (the Tasks menu)
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  detail         text,
  customer_id    uuid references public.customers (id) on delete set null,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  project_id     uuid references public.projects (id) on delete set null,
  owner_id       uuid references public.profiles (id),
  priority       text not null default 'medium' check (priority in ('high','medium','low')),
  status         text not null default 'open' check (status in ('open','done')),
  due_date       date,
  done_at        timestamptz,
  deleted_at     timestamptz,
  created_by     uuid references public.profiles (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists tasks_owner_idx on public.tasks (owner_id, status);
create index if not exists tasks_due_idx on public.tasks (due_date);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
drop trigger if exists tasks_guard_soft_delete on public.tasks;
create trigger tasks_guard_soft_delete before update on public.tasks
  for each row execute function public.guard_soft_delete();

alter table public.tasks enable row level security;
drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated using (true);
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated with check (true);
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated using (true) with check (true);
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated using (public.is_manager_or_admin());

-- ---------------------------------------------------------------------------
-- Helpful indexes for the customers list (search by name/code) — speeds up
-- the "slow customer page".
-- ---------------------------------------------------------------------------
create index if not exists customers_code_idx on public.customers (code);
create index if not exists opportunities_customer_stage_idx
  on public.opportunities (customer_id, stage) where deleted_at is null;

-- ############################################################################
-- # SECTION 5 · 0006_revenue_tracking.sql
-- ############################################################################

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


-- ############################################################################
-- # OPTIONAL SAMPLE DATA  (from seed.sql)
-- # Delete from this banner to the end of the file if you do NOT want demo rows.
-- ############################################################################

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
