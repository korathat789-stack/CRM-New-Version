-- ============================================================================
-- 0009_goods_receipts.sql — Warehouse Phase 2: Goods Receipt + approval.
-- Additive only. Approval applies stock via approve_goods_receipt() → the
-- Phase 1 apply_stock_movement trigger increments products.qty_on_hand.
-- ============================================================================

create sequence if not exists public.goods_receipt_no_seq start 1;

-- ---------------------------------------------------------------------------
-- Goods receipts (header)
-- ---------------------------------------------------------------------------
create table if not exists public.goods_receipts (
  id           uuid primary key default gen_random_uuid(),
  code         text unique,                       -- RCV-000001 (immutable)
  supplier     text not null,
  po_ref       text,
  receipt_date date not null default current_date,
  status       text not null default 'pending'
                 check (status in ('pending','approved','rejected')),
  note         text,
  received_by  uuid references public.profiles (id),
  approved_by  uuid references public.profiles (id),  -- decision actor (approve/reject)
  approved_at  timestamptz,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function public.set_goods_receipt_code()
returns trigger language plpgsql as $$
begin
  if new.code is null then
    new.code := 'RCV-' || lpad(nextval('public.goods_receipt_no_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;
drop trigger if exists goods_receipts_set_code on public.goods_receipts;
create trigger goods_receipts_set_code before insert on public.goods_receipts
  for each row execute function public.set_goods_receipt_code();
drop trigger if exists goods_receipts_set_updated_at on public.goods_receipts;
create trigger goods_receipts_set_updated_at before update on public.goods_receipts
  for each row execute function public.set_updated_at();
create index if not exists goods_receipts_status_idx on public.goods_receipts (status);
create index if not exists goods_receipts_deleted_idx on public.goods_receipts (deleted_at);

-- ---------------------------------------------------------------------------
-- Goods receipt line items
-- ---------------------------------------------------------------------------
create table if not exists public.goods_receipt_items (
  id         uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.goods_receipts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  qty        integer not null check (qty > 0),
  unit       text not null default 'unit'
);
create index if not exists goods_receipt_items_receipt_idx
  on public.goods_receipt_items (receipt_id);

-- ---------------------------------------------------------------------------
-- Approval RPC: flip pending→approved and apply stock, atomically.
-- ---------------------------------------------------------------------------
create or replace function public.approve_goods_receipt(p_receipt_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  updated integer;
begin
  if not public.is_manager_or_admin() then
    raise exception 'forbidden';
  end if;

  update public.goods_receipts
    set status = 'approved', approved_by = auth.uid(), approved_at = now()
    where id = p_receipt_id and status = 'pending';
  get diagnostics updated = row_count;
  if updated = 0 then
    raise exception 'not_pending';
  end if;

  insert into public.stock_movements
    (product_id, qty_delta, reason, source_type, source_id, created_by)
  select product_id, qty, 'receipt', 'goods_receipt', p_receipt_id, auth.uid()
  from public.goods_receipt_items
  where receipt_id = p_receipt_id;
end;
$$;
grant execute on function public.approve_goods_receipt(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.goods_receipts      enable row level security;
alter table public.goods_receipt_items enable row level security;

create policy goods_receipts_read on public.goods_receipts
  for select to authenticated using (true);
create policy goods_receipts_insert on public.goods_receipts
  for insert to authenticated with check (public.is_manager_or_admin());
create policy goods_receipts_update on public.goods_receipts
  for update to authenticated using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());
create policy goods_receipts_delete on public.goods_receipts
  for delete to authenticated using (public.is_manager_or_admin());

create policy goods_receipt_items_read on public.goods_receipt_items
  for select to authenticated using (true);
create policy goods_receipt_items_insert on public.goods_receipt_items
  for insert to authenticated with check (public.is_manager_or_admin());
create policy goods_receipt_items_update on public.goods_receipt_items
  for update to authenticated using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());
create policy goods_receipt_items_delete on public.goods_receipt_items
  for delete to authenticated using (public.is_manager_or_admin());
