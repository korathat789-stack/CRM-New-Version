-- Customer Page — initial schema
-- Run in the Supabase SQL Editor (Dashboard → SQL Editor → New query),
-- or with the Supabase CLI: `supabase db push`.

create extension if not exists "pgcrypto";

create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  company       text,
  email         text,
  phone         text,
  status        text        not null default 'active'
                  check (status in ('active', 'lead', 'inactive')),
  address       text,
  city          text,
  country       text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Keep updated_at fresh on every update.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- Helpful indexes for search & sorting.
create index if not exists customers_created_at_idx on public.customers (created_at desc);
create index if not exists customers_name_idx on public.customers (lower(name));
create index if not exists customers_status_idx on public.customers (status);

-- Row Level Security.
-- This demo uses the anon key from the browser, so we allow anon full access.
-- TIGHTEN THIS before going to production (e.g. require auth.role() = 'authenticated').
alter table public.customers enable row level security;

drop policy if exists "Public read access" on public.customers;
create policy "Public read access"
  on public.customers for select
  using (true);

drop policy if exists "Public write access" on public.customers;
create policy "Public write access"
  on public.customers for all
  using (true)
  with check (true);
