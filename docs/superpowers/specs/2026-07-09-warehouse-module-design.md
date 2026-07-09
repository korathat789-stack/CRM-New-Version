# Warehouse Module — Design Spec

**Date:** 2026-07-09
**Status:** Approved design → pending implementation plan
**Branch (current):** `claude/quotation-pdf-integrate`
**Reference:** `MatchPoint CRM Prototype.html` (the "Warehouse" sidebar group:
Inventory, Goods Receipt, Disbursement, Approval).

## Context

The MatchPoint CRM prototype has a full **Warehouse** sidebar group that the
repo does not implement at all (0 files for inventory/goods-receipt/
disbursement). There is also **no product / SKU master** anywhere in the repo —
`/settings/catalog` only manages `customer_types` and `grade_bands`, and
quotation line items are free-form text.

This spec covers the Warehouse module as a whole, but is **built in phases**.
The full data model is designed up front so later phases connect cleanly; only
**Phase 1 (Inventory + product master)** is implemented from this spec. Phases 2
and 3 each get their own spec → plan → build cycle later.

Phasing (agreed with user):

- **Phase 1 — Inventory + product master** (this spec): product/SKU master,
  inventory list, create/edit product, manual stock adjustment with an
  append-only ledger. Nav group "Warehouse" → "Inventory".
- **Phase 2 — Goods Receipt + Approval** (later): receive stock from a supplier;
  manager/admin approve → stock increases.
- **Phase 3 — Disbursement + Approval** (later): issue stock to a project;
  manager/admin approve → stock decreases.

## Goals (Phase 1)

- A product/SKU master: SKU code, name, category, unit, cost, sell price, safety
  stock, description, active flag.
- An `/inventory` list showing each product with current on-hand qty, a status
  badge (In Stock / Low / Out derived from qty vs safety stock), and stock value
  (qty × cost). Filters: category, status, text search. Summary cards: Total
  SKUs, Low/Out count, total Stock Value.
- Create / edit a product (`manager`+`admin` only).
- Adjust on-hand stock (+/- with a reason and note) that writes an **append-only
  stock ledger** and keeps `qty_on_hand` in sync (`manager`+`admin` only).
- New sidebar group **Warehouse** with an **Inventory** item; visible to all
  roles, `sales` read-only.
- i18n (en + th) for all new nav and page strings.

## Non-goals (Phase 1)

- No Goods Receipt, Disbursement, or Approval — no tables, routes, actions, or
  forms (Phases 2/3). The ledger's `source_type`/`source_id` columns already
  accommodate future linking (bare uuid, no FK), so those tables are NOT needed
  in Phase 1 and are deferred to their own phase migrations (YAGNI).
- No quotation integration — quotation line items stay free-form. A product
  picker in the quotation form is explicitly out of scope for now.
- No product image / datasheet upload (prototype has `image`/`datasheet` fields
  but they are null; skip — YAGNI). A nullable `datasheet_url` column is fine to
  add but no upload UI.
- No supplier master table (Phase 2 stores supplier as free text, matching the
  prototype).
- No stock reservation / in-transit tracking (prototype's "In-Transit" card
  comes from project deliveries, not inventory; out of scope here).

## Data model — migration `0008_warehouse.sql` (additive, new tables only)

Follows existing conventions: `gen_random_uuid()` PKs, `satang` bigint money,
`deleted_at` soft delete, `set_updated_at()` trigger, `created_by` → `profiles`,
sequence + `before insert` trigger for auto codes, and the same RLS helpers
(`is_manager_or_admin()`).

### Enum

```
create type public.product_category as enum (
  'rfid_readers','antennas','tags','printers','networking','accessories','software'
);
```

(Matches the prototype's 7 categories. New values can be added later with
`alter type`.)

### `public.products` — SKU master + current stock (Phase 1)

- `id` uuid pk
- `code` text unique not null — the SKU, **user-entered** (e.g. `RFID-FX-001`),
  not auto-generated (SKUs are meaningful).
- `name` text not null
- `category` public.product_category not null
- `unit` text not null default 'unit'
- `cost` bigint not null default 0 — satang
- `sell_price` bigint not null default 0 — satang
- `qty_on_hand` integer not null default 0 — maintained by the ledger trigger
- `safety_stock` integer not null default 0 — reorder threshold
- `description` text
- `datasheet_url` text (nullable; no upload UI in Phase 1)
- `is_active` boolean not null default true
- `deleted_at` timestamptz
- `created_by` uuid → profiles, `created_at`, `updated_at`
- Indexes: `lower(name)`, `category`, `deleted_at`.
- Stock status is **derived, not stored**: `Out` when `qty_on_hand = 0`, `Low`
  when `qty_on_hand <= safety_stock`, else `In Stock` (computed in the app layer
  so the thresholds live in one place — `src/lib/inventory.ts`).

### `public.stock_movements` — append-only ledger (Phase 1)

- `id` uuid pk
- `product_id` uuid not null → products (on delete restrict)
- `qty_delta` integer not null check (qty_delta <> 0) — signed (+ receipt/positive
  adjust, − disbursement/negative adjust)
- `reason` text not null check (reason in ('adjustment','receipt','disbursement'))
- `source_type` text check (source_type in ('adjustment','goods_receipt','disbursement'))
- `source_id` uuid — null in Phase 1 (points at a GR/DSB row in Phases 2/3)
- `note` text
- `created_by` uuid → profiles, `created_at`
- Index: `product_id, created_at`.
- **Trigger** `stock_movements_apply` (after insert): `update products set
  qty_on_hand = qty_on_hand + new.qty_delta where id = new.product_id`. This is
  the single place stock changes; Phases 2/3 approval just inserts a movement.
- Guard: reject an insert that would drive `qty_on_hand` negative (raises an
  exception) so a bad adjustment/disbursement can't create negative stock.

### Future phases (NOT in this migration — for design continuity only)

Phase 2/3 will add their own migrations. Sketched here so Phase 1 choices stay
forward-compatible; do **not** create these tables now.

- Phase 2: `goods_receipts` (code `RCV-000001`, supplier, po_ref, status
  pending/approved/rejected, received_by/approved_by) + `goods_receipt_items`
  (product_id, qty). Approve → insert a `stock_movements` row per item with
  `reason='receipt'`, `source_type='goods_receipt'`, `source_id=<receipt id>`.
- Phase 3: `disbursements` (code `DSB-000001`, project_id, status, requested_by/
  approved_by) + `disbursement_items`. Approve → insert `stock_movements` with
  `reason='disbursement'`, negative `qty_delta`, `source_type='disbursement'`.

### RLS (Phase 1 tables)

- `products` and `stock_movements`:
  - `..._read` — `for select to authenticated using (true)` (everyone incl.
    `sales` can view).
  - `..._write` — `for insert`/`update` to authenticated using/​with check
    `public.is_manager_or_admin()`.
- `stock_movements` is append-only: **no** update or delete policy (immutable
  ledger).
- `products` delete: `manager`+`admin` (soft delete via `deleted_at` in practice;
  a hard-delete policy gated to `is_manager_or_admin()` mirrors existing tables).

## Application layer (Phase 1)

- `src/lib/inventory.ts` — types + data loaders + pure helpers:
  - `stockStatus(qtyOnHand, safetyStock): 'in_stock' | 'low' | 'out'`
  - `stockValue(qtyOnHand, cost): number` (satang)
  - `listProducts(filters)` — server loader (category/status/search).
  - `getProduct(id)`, `inventorySummary()` (Total SKUs, Low/Out count, Stock
    Value) — reuse loaders where practical.
  - `PRODUCT_CATEGORIES` constant (code + i18n key) and status colour map
    (mirrors `QUOTATION_STATUS_COLORS`).
- `src/app/(app)/inventory/actions.ts` — server actions (all guarded with
  `requireRole(['admin','manager'])`, mirroring `settings/catalog/actions.ts`):
  - `createProduct`, `updateProduct`, `deleteProduct` (soft delete).
  - `adjustStock(productId, qtyDelta, note)` → inserts a `stock_movements` row
    with `reason='adjustment'`. Validation: non-zero delta; the DB guard blocks
    negative stock and the action surfaces a friendly error.
- Pages:
  - `src/app/(app)/inventory/page.tsx` — server component list + summary cards +
    filters. Uses a small client component for filter controls and the adjust
    dialog.
  - `src/app/(app)/inventory/new/page.tsx`, `.../[id]/edit/page.tsx` — render
    `ProductForm`.
  - `src/components/inventory/ProductForm.tsx` — create/edit form (client),
    following `CustomerForm`/`ProjectForm` patterns (`useActionState`, field
    errors, toast).
  - `src/components/inventory/StockAdjuster.tsx` — +/- adjust control/dialog on
    each row or the list, visible to `manager`+`admin`.
- Nav: add group `warehouse` to `src/lib/roles.ts` `NAV` with item
  `{ href: '/inventory', labelKey: 'nav.inventory', icon: 'Package' }`, visible
  to all roles; register the `Package` (or `Warehouse`) lucide icon in
  `Sidebar.tsx`'s `ICONS` map. Extend `NavGroupId` with `'warehouse'`.
- i18n: add `nav.group.warehouse`, `nav.inventory`, and an `inventory.*` block
  (page title, columns, status labels, category labels, form labels, adjust
  dialog, toasts) to both `messages/en.json` and `messages/th.json`.

## Roles / permissions summary

- **View** inventory: all roles (`admin`, `manager`, `sales`).
- **Create/edit/delete** product, **adjust** stock: `manager` + `admin` only
  (enforced by RLS + `requireRole` in actions; UI hides the buttons for `sales`).

## Error / loading / empty states

- Empty: no products → friendly empty state with a "New product" CTA
  (manager+admin) / plain message (sales).
- Loading: route `loading.tsx` already exists at the `(app)` level; add a local
  skeleton if needed.
- Errors: server actions return `{ ok, error }`, surfaced via the existing
  toast pattern. Negative-stock guard error maps to a specific message.
- Duplicate SKU (`code` unique violation) → field error on `code`.

## Testing

- `src/lib/__tests__/inventory.test.ts` (node `--test`, matching existing tests):
  - `stockStatus`: qty 0 → out; qty ≤ safety → low; qty > safety → in_stock;
    boundary at exactly safety.
  - `stockValue`: qty × cost in satang, incl. 0.
- Manual QA: create product, adjust stock up/down, verify status badge + stock
  value + summary cards update; verify `sales` sees read-only (no buttons);
  verify negative adjustment is blocked.
- Gate: `npx tsc --noEmit`, `npx next build`, and `npm test` must all pass.

## Impact / verification

- **New** migration `0008_warehouse.sql` (additive; touches no existing table).
- **New** routes under `/inventory`; **new** lib/`components` files; small edits
  to `src/lib/roles.ts`, `src/components/shell/Sidebar.tsx`, and both message
  files.
- No changes to existing modules' behavior.
- Rollback: drop `stock_movements`, `products`, and the `product_category` enum
  (migration is self-contained; no new sequences — SKU is user-entered); revert
  the roles/Sidebar/messages edits.

## QA outcome (Phase 1)

**Date:** 2026-07-09 · **Status:** automated gate PASS; manual/staging QA PENDING.

Built via subagent-driven-development (9 tasks, each implemented + independently
reviewed). Commits `cd6abb8`..`2fbe4f5` on `claude/quotation-pdf-integrate`.

Automated gate (run on the merged tree):

- `npm test` — 24/24 passing (incl. new `stockStatus`/`stockValue` unit tests),
  output pristine.
- `npx tsc --noEmit` — clean.
- `npx next build` — succeeds; route list includes `/inventory`,
  `/inventory/new`, `/inventory/[id]/edit`.

Notable implementation note: during Task 8, `src/lib/inventory.ts` was found to
mix client-safe constants with server-only Supabase loaders, which broke the
client bundle (`next build`) once a client component imported a constant. Fixed
by extracting the pure pieces into `src/lib/inventory-shared.ts` and re-exporting
from `inventory.ts` (public API unchanged), mirroring the repo's `stages.ts` vs
`opportunities.ts` split. Reviewed and confirmed correct/minimal.

Still PENDING (ops / not doable in this session — no live DB or auth session):

- Apply migration `0008_warehouse.sql` to dev/staging Supabase (never prod
  directly).
- Manual browser QA per the plan's Task 9 Step 2: create product → status Out;
  adjust +/− → status/value/summary update; over-disburse blocked
  (negative-stock guard); duplicate SKU error; edit + active toggle; filters +
  search; and `sales` sees read-only (no New/Edit/Adjust, `/inventory/new`
  redirects).

Deferred to later phases (not in Phase 1): Goods Receipt, Disbursement,
Approval, quotation↔catalog integration.
