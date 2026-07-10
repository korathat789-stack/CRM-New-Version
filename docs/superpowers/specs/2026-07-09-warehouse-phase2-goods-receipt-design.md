# Warehouse Phase 2 — Goods Receipt + Approval — Design Spec

**Date:** 2026-07-09
**Status:** Approved design → pending implementation plan
**Branch:** `claude/warehouse-phase2` (from `claude/customer-page-wireframes-hjeif8`)
**Builds on:** Phase 1 (`docs/superpowers/specs/2026-07-09-warehouse-module-design.md`) —
`products`, `stock_movements` ledger, `apply_stock_movement()` trigger, RLS,
`canManageInventory`, Warehouse nav group.
**Reference:** `MatchPoint CRM Prototype.html` — Warehouse group items "Goods
Receipt" and "Approval".

## Context

Phase 1 delivered the Inventory module (product master + append-only stock
ledger). Phase 2 adds **Goods Receipt** — recording stock received from a
supplier — and an **Approval** step: a receipt is created as `pending`, and a
manager/admin approves it, which applies the received quantities to inventory
(one `stock_movements` row per line, `reason='receipt'`). The Phase 1 ledger and
its `apply_stock_movement()` trigger already support this — approval only needs
to insert movements; the trigger increments `products.qty_on_hand`.

The Phase 1 `stock_movements` table already carries `source_type`
(`'goods_receipt'`) and `source_id` for linking a movement back to its receipt.

## Goals

- A **Goods Receipt** document: supplier, PO reference, receipt date, note, and
  one or more line items (product + quantity + unit). Auto code `RCV-000001`.
- Lifecycle: `pending` → `approved` (applies stock) or `pending` → `rejected`
  (no stock change). `approved`/`rejected` are terminal.
- **Approval applies stock exactly once, atomically**: a Postgres RPC
  `approve_goods_receipt(id)` flips the status (guarded to `pending`) and inserts
  one `stock_movements` row per line, all in one transaction. Double-approval is
  a no-op.
- A dedicated **Approval** page listing pending receipts with Approve / Reject
  actions (Phase 3 will add pending disbursements to the same page).
- Roles: `manager`+`admin` create, edit (pending only), delete (pending only),
  approve, and reject. `sales` has no access to Goods Receipt / Approval (nav
  items hidden AND pages redirect). Self-approval is allowed (the creator may
  approve their own receipt).
- i18n (en + th) for all new nav and page strings.

## Non-goals

- No Disbursement (Phase 3), no changes to the Approval page's future
  disbursement rows (only receipts in Phase 2).
- No supplier master table — `supplier` is free text (matches the prototype).
- No editing or deletion of `approved`/`rejected` receipts; no "un-approve" /
  stock reversal (a correction is a separate manual stock adjustment via Phase 1,
  or a future feature — out of scope).
- No PO (purchase order) module — `po_ref` is a free-text reference only.
- No partial approval (a receipt is approved whole or not at all).
- No quotation/catalog changes.

## Data model — migration `0009_goods_receipts.sql` (additive, new objects only)

Follows existing conventions: `gen_random_uuid()` PKs, `deleted_at` soft delete,
`set_updated_at()` trigger, `created_by`/`*_by` → `profiles`, sequence +
`before insert` trigger for the code, `is_manager_or_admin()` in RLS.

### `public.goods_receipts`

- `id` uuid pk
- `code` text unique — `RCV-000001`, auto via `goods_receipt_no_seq` +
  `set_goods_receipt_code()` trigger (mirrors `set_quotation_number` /
  `set_customer_code` patterns).
- `supplier` text not null
- `po_ref` text (nullable)
- `receipt_date` date not null default current_date
- `status` text not null default 'pending'
  check (status in ('pending','approved','rejected'))
- `note` text
- `received_by` uuid → profiles (set to creator on insert)
- `approved_by` uuid → profiles (null until approved/rejected)
- `approved_at` timestamptz (null until approved/rejected)
- `deleted_at` timestamptz
- `created_at`, `updated_at` (+ `set_updated_at()` trigger)
- Indexes: `status`, `deleted_at`.

### `public.goods_receipt_items`

- `id` uuid pk
- `receipt_id` uuid not null → goods_receipts (on delete cascade)
- `product_id` uuid not null → products (on delete restrict)
- `qty` integer not null check (qty > 0)
- `unit` text not null default 'unit' (snapshot of the product's unit at entry)
- Index: `receipt_id`.

### Sequence + code trigger

```
create sequence if not exists public.goods_receipt_no_seq start 1;
-- set_goods_receipt_code(): code := 'RCV-' || lpad(nextval(...)::text, 6, '0')
```

### RPC `public.approve_goods_receipt(p_receipt_id uuid)`

`language plpgsql security definer`, `set search_path = public`. Steps, in one
transaction:

1. If not `public.is_manager_or_admin()` → `raise exception 'forbidden'`.
2. `update goods_receipts set status='approved', approved_by=auth.uid(),
   approved_at=now() where id=p_receipt_id and status='pending'` — capture row
   count. If zero rows updated → `raise exception 'not_pending'` (covers
   already-approved/rejected/missing, making the call idempotent-safe).
3. `insert into stock_movements (product_id, qty_delta, reason, source_type,
   source_id, created_by) select product_id, qty, 'receipt', 'goods_receipt',
   p_receipt_id, auth.uid() from goods_receipt_items where receipt_id=p_receipt_id`.
   The Phase 1 `apply_stock_movement` trigger increments `qty_on_hand` per row.

Because the whole function is one transaction, a failure anywhere rolls back both
the status change and any inserted movements. `SECURITY DEFINER` lets it write
`stock_movements` regardless of RLS, but the internal `is_manager_or_admin()`
check is the real gate. Reject does NOT need an RPC (see actions).

### RLS

- `goods_receipts`, `goods_receipt_items`:
  - `..._read` — `select to authenticated using (true)`.
  - `..._insert` / `..._update` — to authenticated with/using
    `public.is_manager_or_admin()`.
  - `goods_receipts` delete policy gated to `is_manager_or_admin()` (soft delete
    is used in practice; the action restricts to `pending`).
- `stock_movements` already denies update/delete (Phase 1); the RPC inserts via
  `SECURITY DEFINER`.

## Application layer

- `src/lib/goodsReceipts-shared.ts` (pure — client-safe, no Supabase import):
  - `type GoodsReceiptStatus = 'pending' | 'approved' | 'rejected'`
  - `GR_STATUS_COLORS: Record<GoodsReceiptStatus, {bg; fg}>`
  - `GR_STATUS_LABEL_KEYS` (i18n key per status)
  - `receiptTotalQty(items): number`, `canEditReceipt(status)`,
    `canApproveReceipt(status)` — pure helpers (unit-tested).
- `src/lib/goodsReceipts.ts` (server loaders; re-exports the shared surface):
  - `listGoodsReceipts(filters: { status?: string })` → rows with code, supplier,
    date, status, line count / total qty, created-by name.
  - `getGoodsReceipt(id)` → header + items (with product code/name) + creator /
    approver names.
  - `listPendingReceipts()` → pending receipts (+ items summary) for the Approval
    page.
  - `listProductOptions()` → `{id, code, name, unit}[]` for the receipt form's
    product picker (active, non-deleted products). (May reuse a lightweight
    select over `products`.)
- `src/app/(app)/goods-receipts/actions.ts` (all guarded: `getCurrentUser` +
  role in `admin`/`manager`, returning `{ok,error:"forbidden"}` otherwise):
  - `createGoodsReceipt(prev, formData)` — inserts header + items (validates
    supplier + ≥1 line with qty>0); redirects to the detail page.
  - `updateGoodsReceipt(prev, formData)` — pending only; replaces items.
  - `deleteGoodsReceipt(id)` — pending only; soft delete.
  - `approveGoodsReceipt(id)` — calls `supabase.rpc('approve_goods_receipt', …)`;
    maps `not_pending` → `error:"notPending"`, `forbidden` → `error:"forbidden"`.
  - `rejectGoodsReceipt(id, note?)` — `update status='rejected', approved_by,
    approved_at where id=? and status='pending'`; no stock change.
- Pages (Warehouse group):
  - `src/app/(app)/goods-receipts/page.tsx` — list + status filter + New button
    (manager/admin). Server component; redirect `sales` to `/inventory`.
  - `.../goods-receipts/new/page.tsx`, `.../[id]/edit/page.tsx` — render
    `GoodsReceiptForm`.
  - `.../goods-receipts/[id]/page.tsx` — detail (header + items + status).
  - `src/app/(app)/approvals/page.tsx` — pending receipts with Approve / Reject
    (manager/admin; redirect others).
  - Components: `src/components/goods-receipts/GoodsReceiptForm.tsx` (client;
    header fields + dynamic product line rows), `ReceiptStatusBadge.tsx`,
    and approve/reject controls (client, `useTransition` + toast) used on the
    Approval page.
- Nav (`src/lib/roles.ts`): add to the existing `warehouse` group two items —
  `{ href:"/goods-receipts", labelKey:"nav.goodsReceipt", icon:"PackagePlus",
  roles:["admin","manager"] }` and `{ href:"/approvals",
  labelKey:"nav.approvals", icon:"ShieldCheck", roles:["admin","manager"] }`.
  This requires adding an **optional** `roles?: Role[]` to `NavItem` (default =
  the group's roles) and filtering per-item in `Sidebar`/`visibleNav`. Register
  `PackagePlus` and `ShieldCheck` in `Sidebar`'s `ICONS`.
- i18n: add `nav.goodsReceipt`, `nav.approvals`, and `goodsReceipts.*` +
  `approvals.*` blocks to both `messages/en.json` and `messages/th.json`.

## Roles / permissions summary

- Goods Receipt + Approval: `manager` + `admin` only — nav items hidden for
  `sales`, and every page/action redirects or rejects `sales`. Enforced by RLS +
  the RPC's internal check + server-action role checks.
- Self-approval allowed (no distinct-approver requirement).

## Error / loading / empty states

- Empty: no receipts → friendly empty state + New CTA; no pending → "nothing to
  approve" on the Approval page.
- Approve conflict: if a receipt is no longer pending (race / already handled),
  the RPC raises `not_pending`; the action maps it to a toast and the page
  refreshes.
- Validation: supplier required; at least one line with qty>0; server rejects
  otherwise.
- Errors surfaced via the existing toast pattern.

## Testing

- `src/lib/__tests__/lib.test.ts` (append): `receiptTotalQty`,
  `canEditReceipt`/`canApproveReceipt` (only `pending` is editable/approvable).
- The approval RPC (stock application, idempotency) is DB-level and is covered by
  **manual QA** on staging (matches the repo's convention of not unit-testing
  DB-backed loaders/RPCs).
- Manual QA: create receipt (pending, no stock change) → approve → stock rises by
  the line quantities, movements appear, status approved; re-approving is a
  no-op; reject leaves stock unchanged; `sales` cannot see or reach the pages;
  edit/delete blocked once approved.
- Gate: `npm test`, `npx tsc --noEmit`, `npx next build` all pass.

## Impact / verification

- **New** migration `0009_goods_receipts.sql` (additive; new tables, sequence,
  code trigger, approval RPC, RLS — touches no existing table).
- **New** routes under `/goods-receipts` and `/approvals`; new lib/components;
  small edits to `src/lib/roles.ts` (+ optional `NavItem.roles`),
  `src/components/shell/Sidebar.tsx` (icons), and both message files.
- No changes to existing modules' behavior.
- Rollback: drop the RPC, `goods_receipt_items`, `goods_receipts`, and
  `goods_receipt_no_seq`; revert the roles/Sidebar/messages edits. (Stock already
  applied by an approval stays as ledger history — expected.)

## Deferred to Phase 3

Disbursement (issue stock to a project) + its approval on the same Approval page;
approving a disbursement inserts negative `stock_movements` (`reason=
'disbursement'`).
