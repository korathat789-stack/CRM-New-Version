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
