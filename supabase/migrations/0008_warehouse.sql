-- ============================================================================
-- 0008_warehouse.sql — Warehouse Phase 1: product/SKU master + stock ledger.
-- Additive only; touches no existing table.
-- ============================================================================

-- Product categories (extend later with `alter type ... add value`).
do $$ begin
  create type public.product_category as enum (
    'rfid_readers','antennas','tags','printers','networking','accessories','software'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Products (SKU master + current on-hand stock)
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,                 -- SKU, user-entered
  name          text not null,
  category      public.product_category not null,
  unit          text not null default 'unit',
  cost          bigint not null default 0,            -- satang
  sell_price    bigint not null default 0,            -- satang
  qty_on_hand   integer not null default 0,           -- maintained by ledger trigger
  safety_stock  integer not null default 0,
  description   text,
  datasheet_url text,
  is_active     boolean not null default true,
  deleted_at    timestamptz,
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create index if not exists products_name_idx on public.products (lower(name));
create index if not exists products_category_idx on public.products (category);
create index if not exists products_deleted_idx on public.products (deleted_at);

-- ---------------------------------------------------------------------------
-- Stock movements (append-only ledger). qty_delta is signed.
-- ---------------------------------------------------------------------------
create table if not exists public.stock_movements (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete restrict,
  qty_delta   integer not null check (qty_delta <> 0),
  reason      text not null check (reason in ('adjustment','receipt','disbursement')),
  source_type text check (source_type in ('adjustment','goods_receipt','disbursement')),
  source_id   uuid,                                   -- null in Phase 1
  note        text,
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);
create index if not exists stock_movements_product_idx
  on public.stock_movements (product_id, created_at);

-- Apply each movement to the product's on-hand qty; block negative stock.
create or replace function public.apply_stock_movement()
returns trigger language plpgsql as $$
declare
  new_qty integer;
begin
  update public.products
    set qty_on_hand = qty_on_hand + new.qty_delta
    where id = new.product_id
    returning qty_on_hand into new_qty;
  if new_qty < 0 then
    raise exception 'insufficient_stock';
  end if;
  return new;
end;
$$;
drop trigger if exists stock_movements_apply on public.stock_movements;
create trigger stock_movements_apply after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- ---------------------------------------------------------------------------
-- Row Level Security
--   * everyone (authenticated) can read
--   * only manager/admin can write products
--   * stock_movements: manager/admin insert only; append-only (no update/delete)
-- ---------------------------------------------------------------------------
alter table public.products        enable row level security;
alter table public.stock_movements enable row level security;

create policy products_read on public.products
  for select to authenticated using (true);
create policy products_insert on public.products
  for insert to authenticated with check (public.is_manager_or_admin());
create policy products_update on public.products
  for update to authenticated using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());
create policy products_delete on public.products
  for delete to authenticated using (public.is_manager_or_admin());

create policy stock_movements_read on public.stock_movements
  for select to authenticated using (true);
create policy stock_movements_insert on public.stock_movements
  for insert to authenticated with check (public.is_manager_or_admin());
