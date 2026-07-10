# Warehouse Phase 2 — Goods Receipt + Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Goods Receipt documents (supplier + product lines, code `RCV-000001`) with a manager/admin approval step that atomically applies received quantities to inventory, plus a dedicated Approval page.

**Architecture:** New Supabase tables `goods_receipts` + `goods_receipt_items`, a code sequence/trigger, and a `SECURITY DEFINER` RPC `approve_goods_receipt(id)` that flips status `pending`→`approved` (guarded) and inserts one `stock_movements` row per line in one transaction — the Phase 1 `apply_stock_movement` trigger then increments stock. New `/goods-receipts` and `/approvals` routes following the Phase 1 inventory patterns, with a client/server-split lib (`goodsReceipts-shared.ts` pure, `goodsReceipts.ts` loaders).

**Tech Stack:** Next.js App Router (server components + server actions), TypeScript strict, Supabase (Postgres + RLS + RPC), next-intl (en/th), Tailwind, lucide-react. Tests: `node --test` via tsx.

## Global Constraints

- All new tables get RLS: `select` to `authenticated` (`using (true)`); `insert`/`update` gated to `public.is_manager_or_admin()`. `stock_movements` stays append-only (Phase 1).
- Approval applies stock via the RPC `approve_goods_receipt(id)` ONLY — never insert `stock_movements` for a receipt from application code. The RPC is one transaction, guards `status='pending'` (idempotent), and checks `is_manager_or_admin()` internally.
- Money/quantities: `qty` is a positive integer count (not money). No floats.
- Status values (verbatim): `'pending'`, `'approved'`, `'rejected'`. Only `pending` is editable/deletable/approvable/rejectable; `approved` and `rejected` are terminal.
- Roles: `manager`+`admin` only for all Goods Receipt / Approval pages and actions — nav items hidden for `sales` AND pages redirect `sales` to `/inventory`; actions reject with `{ok:false,error:"forbidden"}`. Server checks use `getCurrentUser()` (non-throwing) so `redirect()` stays outside try/catch (Phase 1 convention). Self-approval is allowed.
- No `any`. Every user-facing string via next-intl in BOTH `messages/en.json` and `messages/th.json` (identical key structure, only values differ).
- Client components must NOT import server-only modules — import pure constants/types from `@/lib/goodsReceipts-shared`, never from `@/lib/goodsReceipts` (Phase 1 client/server-boundary lesson).
- Follow existing patterns: code sequence/trigger like `set_quotation_number` (`0002_mpt_crm_core.sql:367-378`); line items serialized as a JSON string in a hidden `lines` field, parsed in the action (like `createQuotation` in `src/app/(app)/quotations/actions.ts`); loaders like `src/lib/projects.ts`; forms like `ProjectForm`/`QuotationForm`.
- Every task ends green: `npx tsc --noEmit` (and `npm test` where tests exist) before commit. Commit messages end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do not push.

---

### Task 1: Migration — goods_receipts + items + code trigger + approve RPC + RLS

**Files:**
- Create: `supabase/migrations/0009_goods_receipts.sql`

**Interfaces:**
- Consumes: `public.set_updated_at()`, `public.is_manager_or_admin()`, `public.profiles`, `public.products`, `public.stock_movements` (+ its `apply_stock_movement` trigger) — all from earlier migrations.
- Produces: tables `public.goods_receipts`, `public.goods_receipt_items`; sequence `goods_receipt_no_seq`; RPC `public.approve_goods_receipt(uuid)`.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0009_goods_receipts.sql`:

```sql
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
```

- [ ] **Step 2: Sanity-check the SQL parses**

Run: `node -e "const s=require('fs').readFileSync('supabase/migrations/0009_goods_receipts.sql','utf8'); for (const p of [/create table if not exists public\.goods_receipts/,/create table if not exists public\.goods_receipt_items/,/function public\.approve_goods_receipt/,/reason, source_type, source_id/]) if(!p.test(s)) throw new Error('missing '+p); console.log('migration DDL present')"`
Expected: `migration DDL present`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0009_goods_receipts.sql
git commit -m "feat(warehouse): goods_receipts schema, code trigger, approve RPC, RLS

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

> **Note:** Applying `0009` to Supabase is a manual/deploy step verified in Task 10 QA, not in this session.

---

### Task 2: Pure goods-receipt helpers + unit tests (TDD)

**Files:**
- Create: `src/lib/goodsReceipts-shared.ts`
- Modify: `src/lib/__tests__/lib.test.ts` (append)

**Interfaces:**
- Produces:
  - `type GoodsReceiptStatus = 'pending' | 'approved' | 'rejected'`
  - `function receiptTotalQty(items: { qty: number }[]): number`
  - `function canEditReceipt(status: GoodsReceiptStatus): boolean`
  - `function canApproveReceipt(status: GoodsReceiptStatus): boolean`
  - `const GR_STATUS_COLORS: Record<GoodsReceiptStatus, { bg: string; fg: string }>`
  - `const GR_STATUS_LABEL_KEYS: Record<GoodsReceiptStatus, string>`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/lib.test.ts` (import near the top with the others; tests at the end):

```ts
import {
  receiptTotalQty,
  canEditReceipt,
  canApproveReceipt,
} from "../goodsReceipts-shared";

// ---------------------------------------------------------------- goods receipt
test("goodsReceipt: total qty sums line quantities", () => {
  assert.equal(receiptTotalQty([{ qty: 3 }, { qty: 5 }, { qty: 2 }]), 10);
  assert.equal(receiptTotalQty([]), 0);
});

test("goodsReceipt: only pending is editable / approvable", () => {
  assert.equal(canEditReceipt("pending"), true);
  assert.equal(canEditReceipt("approved"), false);
  assert.equal(canEditReceipt("rejected"), false);
  assert.equal(canApproveReceipt("pending"), true);
  assert.equal(canApproveReceipt("approved"), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../goodsReceipts-shared`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/goodsReceipts-shared.ts`:

```ts
// Goods receipt: pure, client-safe types + helpers + status metadata. Server
// loaders live in goodsReceipts.ts. Keeping this module free of Supabase imports
// lets client components import the status metadata without pulling server code.

export type GoodsReceiptStatus = "pending" | "approved" | "rejected";

/** Sum the line quantities of a receipt. */
export function receiptTotalQty(items: { qty: number }[]): number {
  return items.reduce((sum, i) => sum + i.qty, 0);
}

/** Only a pending receipt can be edited or deleted. */
export function canEditReceipt(status: GoodsReceiptStatus): boolean {
  return status === "pending";
}

/** Only a pending receipt can be approved or rejected. */
export function canApproveReceipt(status: GoodsReceiptStatus): boolean {
  return status === "pending";
}

export const GR_STATUS_COLORS: Record<
  GoodsReceiptStatus,
  { bg: string; fg: string }
> = {
  pending: { bg: "#fef9c3", fg: "#a16207" },
  approved: { bg: "#dcfce7", fg: "#15803d" },
  rejected: { bg: "#fee2e2", fg: "#b91c1c" },
};

export const GR_STATUS_LABEL_KEYS: Record<GoodsReceiptStatus, string> = {
  pending: "goodsReceipts.status.pending",
  approved: "goodsReceipts.status.approved",
  rejected: "goodsReceipts.status.rejected",
};

export function isGoodsReceiptStatus(v: string): v is GoodsReceiptStatus {
  return v === "pending" || v === "approved" || v === "rejected";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/goodsReceipts-shared.ts src/lib/__tests__/lib.test.ts
git commit -m "feat(warehouse): goods-receipt status helpers + metadata (tested)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Goods-receipt data loaders

**Files:**
- Create: `src/lib/goodsReceipts.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`; types from `./goodsReceipts-shared`.
- Produces (and re-exports the shared surface):
  - `interface GoodsReceiptRow { id; code; supplier; receipt_date; status: GoodsReceiptStatus; line_count: number; total_qty: number; received_by_name: string | null }`
  - `interface GoodsReceiptItemDetail { id; product_id; product_code; product_name; qty; unit }`
  - `interface GoodsReceiptDetail { id; code; supplier; po_ref: string|null; receipt_date; status: GoodsReceiptStatus; note: string|null; received_by_name: string|null; approved_by_name: string|null; approved_at: string|null; items: GoodsReceiptItemDetail[] }`
  - `interface ProductOption { id; code; name; unit }`
  - `async function listGoodsReceipts(filters: { status?: string }): Promise<GoodsReceiptRow[]>`
  - `async function getGoodsReceipt(id: string): Promise<GoodsReceiptDetail | null>`
  - `async function listPendingReceipts(): Promise<GoodsReceiptDetail[]>`
  - `async function listProductOptions(): Promise<ProductOption[]>`

- [ ] **Step 1: Write the loaders**

Create `src/lib/goodsReceipts.ts`:

```ts
import { createClient } from "./supabase/server";
import {
  isGoodsReceiptStatus,
  receiptTotalQty,
  type GoodsReceiptStatus,
} from "./goodsReceipts-shared";

export {
  receiptTotalQty,
  canEditReceipt,
  canApproveReceipt,
  isGoodsReceiptStatus,
  GR_STATUS_COLORS,
  GR_STATUS_LABEL_KEYS,
  type GoodsReceiptStatus,
} from "./goodsReceipts-shared";

export interface GoodsReceiptRow {
  id: string;
  code: string | null;
  supplier: string;
  receipt_date: string;
  status: GoodsReceiptStatus;
  line_count: number;
  total_qty: number;
  received_by_name: string | null;
}

export interface GoodsReceiptItemDetail {
  id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  qty: number;
  unit: string;
}

export interface GoodsReceiptDetail {
  id: string;
  code: string | null;
  supplier: string;
  po_ref: string | null;
  receipt_date: string;
  status: GoodsReceiptStatus;
  note: string | null;
  received_by_name: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  items: GoodsReceiptItemDetail[];
}

export interface ProductOption {
  id: string;
  code: string;
  name: string;
  unit: string;
}

export async function listGoodsReceipts(filters: {
  status?: string;
}): Promise<GoodsReceiptRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("goods_receipts")
    .select(
      `id, code, supplier, receipt_date, status,
       receiver:profiles!goods_receipts_received_by_fkey(full_name),
       goods_receipt_items(qty)`
    )
    .is("deleted_at", null)
    .order("receipt_date", { ascending: false });

  if (filters.status && isGoodsReceiptStatus(filters.status)) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((r) => {
    const row = r as unknown as {
      id: string;
      code: string | null;
      supplier: string;
      receipt_date: string;
      status: GoodsReceiptStatus;
      receiver: { full_name: string | null } | null;
      goods_receipt_items: { qty: number }[];
    };
    const items = row.goods_receipt_items ?? [];
    return {
      id: row.id,
      code: row.code,
      supplier: row.supplier,
      receipt_date: row.receipt_date,
      status: row.status,
      line_count: items.length,
      total_qty: receiptTotalQty(items),
      received_by_name: row.receiver?.full_name ?? null,
    };
  });
}

const RECEIPT_DETAIL_SELECT = `
  id, code, supplier, po_ref, receipt_date, status, note, approved_at,
  receiver:profiles!goods_receipts_received_by_fkey(full_name),
  approver:profiles!goods_receipts_approved_by_fkey(full_name),
  goods_receipt_items(id, qty, unit, products(id, code, name))`;

function mapReceiptDetail(r: unknown): GoodsReceiptDetail {
  const row = r as {
    id: string;
    code: string | null;
    supplier: string;
    po_ref: string | null;
    receipt_date: string;
    status: GoodsReceiptStatus;
    note: string | null;
    approved_at: string | null;
    receiver: { full_name: string | null } | null;
    approver: { full_name: string | null } | null;
    goods_receipt_items: {
      id: string;
      qty: number;
      unit: string;
      products: { id: string; code: string; name: string } | null;
    }[];
  };
  return {
    id: row.id,
    code: row.code,
    supplier: row.supplier,
    po_ref: row.po_ref,
    receipt_date: row.receipt_date,
    status: row.status,
    note: row.note,
    received_by_name: row.receiver?.full_name ?? null,
    approved_by_name: row.approver?.full_name ?? null,
    approved_at: row.approved_at,
    items: (row.goods_receipt_items ?? []).map((i) => ({
      id: i.id,
      product_id: i.products?.id ?? "",
      product_code: i.products?.code ?? "",
      product_name: i.products?.name ?? "",
      qty: i.qty,
      unit: i.unit,
    })),
  };
}

export async function getGoodsReceipt(
  id: string
): Promise<GoodsReceiptDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goods_receipts")
    .select(RECEIPT_DETAIL_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapReceiptDetail(data);
}

export async function listPendingReceipts(): Promise<GoodsReceiptDetail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goods_receipts")
    .select(RECEIPT_DETAIL_SELECT)
    .eq("status", "pending")
    .is("deleted_at", null)
    .order("receipt_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapReceiptDetail);
}

export async function listProductOptions(): Promise<ProductOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, code, name, unit")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProductOption[];
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/goodsReceipts.ts
git commit -m "feat(warehouse): goods-receipt loaders (list/detail/pending/product-options)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Server actions — create/update/delete/approve/reject

**Files:**
- Create: `src/app/(app)/goods-receipts/actions.ts`

**Interfaces:**
- Consumes: `getCurrentUser` (`@/lib/auth`); `createClient` (`@/lib/supabase/server`).
- Produces:
  - `interface ReceiptFormState { ok: boolean; error?: string }`
  - `async function createGoodsReceipt(prev, formData): Promise<ReceiptFormState>` (redirects to `/goods-receipts/<id>`)
  - `async function updateGoodsReceipt(prev, formData): Promise<ReceiptFormState>` (reads `id`; pending only; redirects)
  - `async function deleteGoodsReceipt(id: string): Promise<{ok:boolean;error?:string}>` (pending only; soft delete)
  - `async function approveGoodsReceipt(id: string): Promise<{ok:boolean;error?:string}>`
  - `async function rejectGoodsReceipt(id: string): Promise<{ok:boolean;error?:string}>`

- [ ] **Step 1: Write the actions file**

Create `src/app/(app)/goods-receipts/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export interface ReceiptFormState {
  ok: boolean;
  error?: string;
}

interface RawLine {
  product_id: string;
  qty: number;
  unit: string;
}

async function requireManager() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin" && user.role !== "manager") return null;
  return user;
}

function readHeader(formData: FormData) {
  return {
    supplier: String(formData.get("supplier") ?? "").trim(),
    po_ref: String(formData.get("po_ref") ?? "").trim() || null,
    receipt_date: String(formData.get("receipt_date") ?? "") || null,
    note: String(formData.get("note") ?? "").trim() || null,
  };
}

function readLines(formData: FormData): RawLine[] {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    raw = [];
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => {
      const o = l as { product_id?: unknown; qty?: unknown; unit?: unknown };
      return {
        product_id: String(o.product_id ?? ""),
        qty: Math.trunc(Number(o.qty) || 0),
        unit: String(o.unit ?? "unit") || "unit",
      };
    })
    .filter((l) => l.product_id && l.qty > 0);
}

export async function createGoodsReceipt(
  _prev: ReceiptFormState,
  formData: FormData
): Promise<ReceiptFormState> {
  const user = await requireManager();
  if (!user) return { ok: false, error: "forbidden" };

  const header = readHeader(formData);
  const lines = readLines(formData);
  if (!header.supplier || lines.length === 0) {
    return { ok: false, error: "required" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goods_receipts")
    .insert({
      supplier: header.supplier,
      po_ref: header.po_ref,
      receipt_date: header.receipt_date ?? undefined,
      note: header.note,
      received_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "saveFailed" };

  const { error: itemsError } = await supabase.from("goods_receipt_items").insert(
    lines.map((l) => ({
      receipt_id: data.id,
      product_id: l.product_id,
      qty: l.qty,
      unit: l.unit,
    }))
  );
  if (itemsError) return { ok: false, error: itemsError.message };

  revalidatePath("/goods-receipts");
  redirect(`/goods-receipts/${data.id}`);
}

export async function updateGoodsReceipt(
  _prev: ReceiptFormState,
  formData: FormData
): Promise<ReceiptFormState> {
  const user = await requireManager();
  if (!user) return { ok: false, error: "forbidden" };

  const id = String(formData.get("id") ?? "");
  const header = readHeader(formData);
  const lines = readLines(formData);
  if (!id || !header.supplier || lines.length === 0) {
    return { ok: false, error: "required" };
  }

  const supabase = await createClient();

  // Guard: only a pending receipt may be edited.
  const { data: current } = await supabase
    .from("goods_receipts")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "notFound" };
  if (current.status !== "pending") return { ok: false, error: "notPending" };

  const { error: headErr } = await supabase
    .from("goods_receipts")
    .update({
      supplier: header.supplier,
      po_ref: header.po_ref,
      receipt_date: header.receipt_date ?? undefined,
      note: header.note,
    })
    .eq("id", id);
  if (headErr) return { ok: false, error: headErr.message };

  // Replace items.
  const { error: delErr } = await supabase
    .from("goods_receipt_items")
    .delete()
    .eq("receipt_id", id);
  if (delErr) return { ok: false, error: delErr.message };
  const { error: insErr } = await supabase.from("goods_receipt_items").insert(
    lines.map((l) => ({
      receipt_id: id,
      product_id: l.product_id,
      qty: l.qty,
      unit: l.unit,
    }))
  );
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/goods-receipts");
  revalidatePath(`/goods-receipts/${id}`);
  redirect(`/goods-receipts/${id}`);
}

export async function deleteGoodsReceipt(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireManager();
  if (!user) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("goods_receipts")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "notFound" };
  if (current.status !== "pending") return { ok: false, error: "notPending" };

  const { error } = await supabase
    .from("goods_receipts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/goods-receipts");
  return { ok: true };
}

export async function approveGoodsReceipt(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireManager();
  if (!user) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_goods_receipt", {
    p_receipt_id: id,
  });
  if (error) {
    if (error.message.includes("not_pending"))
      return { ok: false, error: "notPending" };
    if (error.message.includes("forbidden"))
      return { ok: false, error: "forbidden" };
    return { ok: false, error: error.message };
  }
  revalidatePath("/approvals");
  revalidatePath("/goods-receipts");
  revalidatePath("/inventory");
  return { ok: true };
}

export async function rejectGoodsReceipt(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireManager();
  if (!user) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goods_receipts")
    .update({
      status: "rejected",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "notPending" };
  revalidatePath("/approvals");
  revalidatePath("/goods-receipts");
  return { ok: true };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/goods-receipts/actions.ts"
git commit -m "feat(warehouse): goods-receipt actions incl. approve RPC call + reject

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: i18n strings (en + th)

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/th.json`

**Interfaces:**
- Produces: `nav.goodsReceipt`, `nav.approvals`, and the `goodsReceipts.*` + `approvals.*` blocks consumed by Tasks 6–9.

- [ ] **Step 1: Add nav keys** (inside the existing `"nav"` object, alongside `inventory`):

en.json:
```json
"goodsReceipt": "Goods Receipt",
"approvals": "Approval",
```
th.json:
```json
"goodsReceipt": "รับสินค้าเข้า",
"approvals": "อนุมัติ",
```

- [ ] **Step 2: Add the `goodsReceipts` and `approvals` blocks**

Add these two top-level objects to `messages/en.json`:

```json
"goodsReceipts": {
  "title": "Goods Receipt",
  "subtitle": "{count} receipts",
  "new": "New receipt",
  "edit": "Edit receipt",
  "detail": "Receipt",
  "none": "No goods receipts yet.",
  "cols": {
    "code": "No.",
    "supplier": "Supplier",
    "date": "Date",
    "lines": "Items",
    "qty": "Total qty",
    "status": "Status",
    "received_by": "Received by"
  },
  "status": {
    "all": "All statuses",
    "pending": "Pending",
    "approved": "Approved",
    "rejected": "Rejected"
  },
  "form": {
    "supplier": "Supplier",
    "po_ref": "PO reference",
    "date": "Receipt date",
    "note": "Note",
    "lines": "Items",
    "product": "Product",
    "qty": "Quantity",
    "addLine": "Add item",
    "removeLine": "Remove",
    "save": "Save receipt",
    "required": "Enter a supplier and at least one item with quantity."
  },
  "detailView": {
    "poRef": "PO reference",
    "receivedBy": "Received by",
    "approvedBy": "Decided by",
    "approvedAt": "Decided at"
  },
  "toast": {
    "notPending": "This receipt is no longer pending.",
    "deleted": "Receipt deleted"
  },
  "deleteConfirm": "Delete this pending receipt?"
},
"approvals": {
  "title": "Approval",
  "subtitle": "{count} pending",
  "none": "Nothing to approve.",
  "receiptsHeading": "Goods receipts",
  "approve": "Approve",
  "reject": "Reject",
  "approved": "Approved",
  "rejected": "Rejected",
  "confirmApprove": "Approve {code}? This adds the items to stock.",
  "confirmReject": "Reject {code}?"
}
```

Add the same two objects to `messages/th.json` with Thai values:

```json
"goodsReceipts": {
  "title": "รับสินค้าเข้า",
  "subtitle": "{count} รายการ",
  "new": "สร้างใบรับสินค้า",
  "edit": "แก้ไขใบรับสินค้า",
  "detail": "ใบรับสินค้า",
  "none": "ยังไม่มีใบรับสินค้า",
  "cols": {
    "code": "เลขที่",
    "supplier": "ผู้ขาย",
    "date": "วันที่",
    "lines": "รายการ",
    "qty": "จำนวนรวม",
    "status": "สถานะ",
    "received_by": "ผู้รับ"
  },
  "status": {
    "all": "ทุกสถานะ",
    "pending": "รออนุมัติ",
    "approved": "อนุมัติแล้ว",
    "rejected": "ปฏิเสธ"
  },
  "form": {
    "supplier": "ผู้ขาย",
    "po_ref": "อ้างอิง PO",
    "date": "วันที่รับ",
    "note": "หมายเหตุ",
    "lines": "รายการสินค้า",
    "product": "สินค้า",
    "qty": "จำนวน",
    "addLine": "เพิ่มรายการ",
    "removeLine": "ลบ",
    "save": "บันทึกใบรับสินค้า",
    "required": "กรอกผู้ขายและอย่างน้อย 1 รายการพร้อมจำนวน"
  },
  "detailView": {
    "poRef": "อ้างอิง PO",
    "receivedBy": "ผู้รับ",
    "approvedBy": "ผู้ตัดสิน",
    "approvedAt": "เวลาตัดสิน"
  },
  "toast": {
    "notPending": "ใบรับสินค้านี้ไม่ได้อยู่สถานะรออนุมัติแล้ว",
    "deleted": "ลบใบรับสินค้าแล้ว"
  },
  "deleteConfirm": "ลบใบรับสินค้าที่รออนุมัตินี้?"
},
"approvals": {
  "title": "อนุมัติ",
  "subtitle": "รออนุมัติ {count} รายการ",
  "none": "ไม่มีรายการรออนุมัติ",
  "receiptsHeading": "ใบรับสินค้า",
  "approve": "อนุมัติ",
  "reject": "ปฏิเสธ",
  "approved": "อนุมัติแล้ว",
  "rejected": "ปฏิเสธแล้ว",
  "confirmApprove": "อนุมัติ {code}? ระบบจะเพิ่มสินค้าเข้าสต็อก",
  "confirmReject": "ปฏิเสธ {code}?"
}
```

- [ ] **Step 3: Verify both files parse + key parity**

Run: `node -e "const e=JSON.parse(require('fs').readFileSync('messages/en.json','utf8')),t=JSON.parse(require('fs').readFileSync('messages/th.json','utf8'));const keys=o=>Object.keys(o).flatMap(k=>o[k]&&typeof o[k]==='object'?keys(o[k]).map(s=>k+'.'+s):[k]).sort();const ek=keys(e.goodsReceipts),tk=keys(t.goodsReceipts),ea=keys(e.approvals),ta=keys(t.approvals);if(JSON.stringify(ek)!==JSON.stringify(tk)||JSON.stringify(ea)!==JSON.stringify(ta))throw new Error('key parity mismatch');console.log('json ok; parity ok')"`
Expected: `json ok; parity ok`

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/th.json
git commit -m "i18n(warehouse): goods-receipt + approval strings (en/th)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Nav — per-item roles + Goods Receipt / Approval items

**Files:**
- Modify: `src/lib/roles.ts`
- Modify: `src/components/shell/Sidebar.tsx`

**Interfaces:**
- Consumes: i18n `nav.goodsReceipt`, `nav.approvals` (Task 5).
- Produces: optional `NavItem.roles`; two new items in the `warehouse` group; `PackagePlus`/`ShieldCheck` registered in `Sidebar` ICONS. `visibleNav` filters items by `roles` and drops empty groups.

- [ ] **Step 1: Add optional per-item roles to the nav model in `src/lib/roles.ts`**

Change the `NavItem` interface to add an optional `roles`:

```ts
export interface NavItem {
  /** route href */
  href: string;
  /** i18n key under `nav.*` */
  labelKey: string;
  /** lucide-react icon name */
  icon: string;
  /** roles allowed to SEE this item; defaults to the group's roles */
  roles?: Role[];
}
```

Add the two items to the existing `warehouse` group's `items` array (after the `inventory` item):

```ts
      { href: "/inventory", labelKey: "nav.inventory", icon: "Package" },
      {
        href: "/goods-receipts",
        labelKey: "nav.goodsReceipt",
        icon: "PackagePlus",
        roles: ["admin", "manager"],
      },
      {
        href: "/approvals",
        labelKey: "nav.approvals",
        icon: "ShieldCheck",
        roles: ["admin", "manager"],
      },
```

Update `visibleNav` to filter items by their optional `roles` and drop groups left empty:

```ts
export function visibleNav(role: Role): NavGroup[] {
  return NAV.filter((group) => group.roles.includes(role))
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || item.roles.includes(role)
      ),
    }))
    .filter((group) => group.items.length > 0);
}
```

- [ ] **Step 2: Register the icons in `src/components/shell/Sidebar.tsx`**

Add `PackagePlus` and `ShieldCheck` to the lucide-react import list and to the `ICONS` map (next to `Package`):

Import list:
```ts
  Package,
  PackagePlus,
  ShieldCheck,
  Settings,
```
ICONS map:
```ts
  Package,
  PackagePlus,
  ShieldCheck,
  Settings,
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/roles.ts src/components/shell/Sidebar.tsx
git commit -m "feat(warehouse): per-item nav roles + Goods Receipt/Approval nav items

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: GoodsReceiptForm + new/edit/detail pages

**Files:**
- Create: `src/components/goods-receipts/GoodsReceiptForm.tsx`
- Create: `src/components/goods-receipts/ReceiptStatusBadge.tsx`
- Create: `src/app/(app)/goods-receipts/new/page.tsx`
- Create: `src/app/(app)/goods-receipts/[id]/edit/page.tsx`
- Create: `src/app/(app)/goods-receipts/[id]/page.tsx`

**Interfaces:**
- Consumes: `createGoodsReceipt`, `updateGoodsReceipt`, `ReceiptFormState` (Task 4); `getGoodsReceipt`, `listProductOptions`, `GR_STATUS_COLORS`, `GR_STATUS_LABEL_KEYS`, types (Task 3); `getCurrentUser`, `canManageInventory` (Phase 1).
- Produces: `<GoodsReceiptForm mode initial? products />`; `<ReceiptStatusBadge status />`; the three routes.

- [ ] **Step 1: Write `ReceiptStatusBadge.tsx`**

Create `src/components/goods-receipts/ReceiptStatusBadge.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import {
  GR_STATUS_COLORS,
  GR_STATUS_LABEL_KEYS,
  type GoodsReceiptStatus,
} from "@/lib/goodsReceipts-shared";

export function ReceiptStatusBadge({ status }: { status: GoodsReceiptStatus }) {
  const t = useTranslations();
  const c = GR_STATUS_COLORS[status];
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: c.bg, color: c.fg }}
    >
      {t(GR_STATUS_LABEL_KEYS[status])}
    </span>
  );
}
```

- [ ] **Step 2: Write `GoodsReceiptForm.tsx`**

Create `src/components/goods-receipts/GoodsReceiptForm.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  createGoodsReceipt,
  updateGoodsReceipt,
  type ReceiptFormState,
} from "@/app/(app)/goods-receipts/actions";
import type { ProductOption } from "@/lib/goodsReceipts";

const INITIAL: ReceiptFormState = { ok: false };

export interface ReceiptFormInitial {
  id: string;
  supplier: string;
  po_ref: string;
  receipt_date: string;
  note: string;
  lines: { product_id: string; qty: string; unit: string }[];
}

interface LineRow {
  product_id: string;
  qty: string;
  unit: string;
}

export function GoodsReceiptForm({
  mode,
  products,
  initial,
}: {
  mode: "new" | "edit";
  products: ProductOption[];
  initial?: ReceiptFormInitial;
}) {
  const t = useTranslations("goodsReceipts.form");
  const tc = useTranslations("common");
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    mode === "new" ? createGoodsReceipt : updateGoodsReceipt,
    INITIAL
  );
  const [lines, setLines] = useState<LineRow[]>(
    initial?.lines?.length
      ? initial.lines
      : [{ product_id: "", qty: "", unit: "unit" }]
  );

  const setLine = (i: number, patch: Partial<LineRow>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () =>
    setLines((prev) => [...prev, { product_id: "", qty: "", unit: "unit" }]);
  const removeLine = (i: number) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  // Serialize valid lines to the hidden field the action reads.
  const serialized = JSON.stringify(
    lines
      .filter((l) => l.product_id && Number(l.qty) > 0)
      .map((l) => ({
        product_id: l.product_id,
        qty: Math.trunc(Number(l.qty)),
        unit:
          products.find((p) => p.id === l.product_id)?.unit || l.unit || "unit",
      }))
  );

  return (
    <form action={formAction} className="mx-auto max-w-2xl">
      {mode === "edit" && <input type="hidden" name="id" value={initial?.id} />}
      <input type="hidden" name="lines" value={serialized} />
      <Card>
        <CardHeader>
          <span className="text-base font-bold text-gray-900">
            {mode === "new" ? t("save") : t("save")}
          </span>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">
                {t("supplier")} <span className="text-[#dc2626]">*</span>
              </span>
              <input name="supplier" defaultValue={initial?.supplier} className="input" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">{t("po_ref")}</span>
              <input name="po_ref" defaultValue={initial?.po_ref} className="input" />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">{t("date")}</span>
              <input
                type="date"
                name="receipt_date"
                defaultValue={initial?.receipt_date}
                className="input"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-600">{t("note")}</span>
            <textarea name="note" defaultValue={initial?.note} rows={2} className="input" />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-gray-600">
              {t("lines")} <span className="text-[#dc2626]">*</span>
            </span>
            {lines.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={line.product_id}
                  onChange={(e) => setLine(i, { product_id: e.target.value })}
                  className="input flex-1"
                  aria-label={t("product")}
                >
                  <option value="">{t("product")}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
                <input
                  value={line.qty}
                  onChange={(e) => setLine(i, { qty: e.target.value })}
                  inputMode="numeric"
                  placeholder={t("qty")}
                  className="input w-24 text-right"
                  aria-label={t("qty")}
                />
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-[var(--color-line)] text-gray-500 hover:bg-gray-50"
                  aria-label={t("removeLine")}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1.5 self-start rounded-md border border-dashed border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:border-[var(--color-primary)]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t("addLine")}
            </button>
          </div>

          {state.error && (
            <div className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]">
              {t("required")}
            </div>
          )}
        </CardBody>
        <div className="flex justify-end gap-2 border-t border-[var(--color-line)] px-4 py-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {t("save")}
          </Button>
        </div>
      </Card>
    </form>
  );
}
```

- [ ] **Step 3: Write the new page**

Create `src/app/(app)/goods-receipts/new/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageInventory } from "@/lib/roles";
import { listProductOptions } from "@/lib/goodsReceipts";
import { GoodsReceiptForm } from "@/components/goods-receipts/GoodsReceiptForm";

export default async function NewGoodsReceiptPage() {
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user.role)) redirect("/inventory");
  const t = await getTranslations("goodsReceipts");
  const products = await listProductOptions();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-xl font-bold text-gray-900">{t("new")}</h1>
      <GoodsReceiptForm mode="new" products={products} />
    </div>
  );
}
```

- [ ] **Step 4: Write the edit page**

Create `src/app/(app)/goods-receipts/[id]/edit/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageInventory } from "@/lib/roles";
import { getGoodsReceipt, listProductOptions } from "@/lib/goodsReceipts";
import { canEditReceipt } from "@/lib/goodsReceipts-shared";
import { GoodsReceiptForm } from "@/components/goods-receipts/GoodsReceiptForm";

export default async function EditGoodsReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user.role)) redirect("/inventory");

  const [receipt, products] = await Promise.all([
    getGoodsReceipt(id),
    listProductOptions(),
  ]);
  if (!receipt) notFound();
  if (!canEditReceipt(receipt.status)) redirect(`/goods-receipts/${id}`);
  const t = await getTranslations("goodsReceipts");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-xl font-bold text-gray-900">{t("edit")}</h1>
      <GoodsReceiptForm
        mode="edit"
        products={products}
        initial={{
          id: receipt.id,
          supplier: receipt.supplier,
          po_ref: receipt.po_ref ?? "",
          receipt_date: receipt.receipt_date,
          note: receipt.note ?? "",
          lines: receipt.items.map((i) => ({
            product_id: i.product_id,
            qty: String(i.qty),
            unit: i.unit,
          })),
        }}
      />
    </div>
  );
}
```

- [ ] **Step 5: Write the detail page**

Create `src/app/(app)/goods-receipts/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Pencil } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { canManageInventory } from "@/lib/roles";
import { getGoodsReceipt } from "@/lib/goodsReceipts";
import { canEditReceipt } from "@/lib/goodsReceipts-shared";
import { ReceiptStatusBadge } from "@/components/goods-receipts/ReceiptStatusBadge";

export default async function GoodsReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user.role)) redirect("/inventory");

  const receipt = await getGoodsReceipt(id);
  if (!receipt) notFound();
  const t = await getTranslations("goodsReceipts");
  const tv = await getTranslations("goodsReceipts.detailView");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {receipt.code ?? t("detail")}
          </h1>
          <div className="mt-1">
            <ReceiptStatusBadge status={receipt.status} />
          </div>
        </div>
        {canEditReceipt(receipt.status) && (
          <Link href={`/goods-receipts/${receipt.id}/edit`}>
            <Button variant="ghost">
              <Pencil className="h-4 w-4" aria-hidden />
              {t("edit")}
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <span className="text-sm font-bold text-gray-900">{receipt.supplier}</span>
        </CardHeader>
        <CardBody className="flex flex-col gap-3 text-sm">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Info label={tv("poRef")} value={receipt.po_ref ?? "—"} />
            <Info label={t("cols.date")} value={receipt.receipt_date} />
            <Info label={tv("receivedBy")} value={receipt.received_by_name ?? "—"} />
            <Info
              label={tv("approvedBy")}
              value={receipt.approved_by_name ?? "—"}
            />
          </div>
          <div className="mt-2 overflow-hidden rounded-md border border-[var(--color-line)]">
            <div className="grid grid-cols-[2fr_1fr] bg-gray-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              <div>{t("form.product")}</div>
              <div className="text-right">{t("form.qty")}</div>
            </div>
            {receipt.items.map((it) => (
              <div
                key={it.id}
                className="grid grid-cols-[2fr_1fr] border-t border-[var(--color-line-soft)] px-3 py-2 text-xs"
              >
                <div>
                  <div className="font-semibold text-gray-900">{it.product_name}</div>
                  <div className="text-[10px] text-gray-400">{it.product_code}</div>
                </div>
                <div className="text-right font-bold text-gray-900">
                  {it.qty} {it.unit}
                </div>
              </div>
            ))}
          </div>
          {receipt.note && <p className="text-xs text-gray-500">{receipt.note}</p>}
        </CardBody>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div className="text-gray-800">{value}</div>
    </div>
  );
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "src/components/goods-receipts/GoodsReceiptForm.tsx" "src/components/goods-receipts/ReceiptStatusBadge.tsx" "src/app/(app)/goods-receipts/new/page.tsx" "src/app/(app)/goods-receipts/[id]/edit/page.tsx" "src/app/(app)/goods-receipts/[id]/page.tsx"
git commit -m "feat(warehouse): GoodsReceiptForm + new/edit/detail pages

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Goods receipts list page + status filter

**Files:**
- Create: `src/components/goods-receipts/ReceiptFilters.tsx`
- Create: `src/app/(app)/goods-receipts/page.tsx`

**Interfaces:**
- Consumes: `listGoodsReceipts` (Task 3); `ReceiptStatusBadge` (Task 7); `getCurrentUser`, `canManageInventory`; `isSupabaseConfigured`.
- Produces: the `/goods-receipts` list route.

- [ ] **Step 1: Write `ReceiptFilters.tsx`**

Create `src/components/goods-receipts/ReceiptFilters.tsx`:

```tsx
"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";

export function ReceiptFilters({ status }: { status: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useTranslations("goodsReceipts");
  const [, startTransition] = useTransition();

  const update = (val: string) => {
    const next = new URLSearchParams(params);
    if (!val || val === "all") next.delete("status");
    else next.set("status", val);
    startTransition(() =>
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    );
  };

  return (
    <label className="flex items-center gap-1.5 rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs text-gray-600">
      <span className="font-semibold">{t("cols.status")}:</span>
      <select
        value={status}
        onChange={(e) => update(e.target.value)}
        className="bg-transparent text-xs outline-none"
      >
        <option value="all">{t("status.all")}</option>
        <option value="pending">{t("status.pending")}</option>
        <option value="approved">{t("status.approved")}</option>
        <option value="rejected">{t("status.rejected")}</option>
      </select>
    </label>
  );
}
```

- [ ] **Step 2: Write the list page**

Create `src/app/(app)/goods-receipts/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Plus, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { canManageInventory } from "@/lib/roles";
import { isSupabaseConfigured } from "@/lib/config";
import { listGoodsReceipts } from "@/lib/goodsReceipts";
import { ReceiptFilters } from "@/components/goods-receipts/ReceiptFilters";
import { ReceiptStatusBadge } from "@/components/goods-receipts/ReceiptStatusBadge";

const GRID =
  "grid grid-cols-[1fr_2fr_1fr_0.8fr_1fr_0.4fr] gap-2 items-center";

type SP = { status?: string };

export default async function GoodsReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user.role)) redirect("/inventory");
  const sp = await searchParams;
  const t = await getTranslations("goodsReceipts");

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
        <p className="mt-4 text-sm text-gray-500">{t("none")}</p>
      </div>
    );
  }

  const rows = await listGoodsReceipts({ status: sp.status });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">
            {t("subtitle", { count: rows.length })}
          </p>
        </div>
        <Link href="/goods-receipts/new">
          <Button>
            <Plus className="h-4 w-4" aria-hidden />
            {t("new")}
          </Button>
        </Link>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-[var(--color-line)] bg-gray-50 p-3">
          <ReceiptFilters status={sp.status ?? "all"} />
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">{t("none")}</div>
        ) : (
          <div className="hidden md:block">
            <div className={`${GRID} border-b border-[var(--color-line)] bg-gray-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-gray-500`}>
              <div>{t("cols.code")}</div>
              <div>{t("cols.supplier")}</div>
              <div>{t("cols.date")}</div>
              <div className="text-right">{t("cols.qty")}</div>
              <div>{t("cols.status")}</div>
              <div />
            </div>
            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/goods-receipts/${r.id}`}
                className={`${GRID} border-b border-[var(--color-line-soft)] px-4 py-2.5 text-xs hover:bg-gray-50`}
              >
                <div className="font-semibold text-gray-900">{r.code ?? "—"}</div>
                <div className="text-gray-700">{r.supplier}</div>
                <div className="text-gray-500">{r.receipt_date}</div>
                <div className="text-right font-bold text-gray-900">{r.total_qty}</div>
                <div>
                  <ReceiptStatusBadge status={r.status} />
                </div>
                <div className="text-right text-[var(--color-primary)]">
                  <ArrowUpRight className="ml-auto h-3.5 w-3.5" aria-hidden />
                </div>
              </Link>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <div className="md:hidden">
            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/goods-receipts/${r.id}`}
                className="flex flex-col gap-1 border-b border-[var(--color-line-soft)] p-3 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-900">{r.code ?? "—"}</span>
                  <ReceiptStatusBadge status={r.status} />
                </div>
                <div className="text-gray-700">{r.supplier}</div>
                <div className="flex justify-between text-gray-500">
                  <span>{r.receipt_date}</span>
                  <span>{r.total_qty}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/components/goods-receipts/ReceiptFilters.tsx" "src/app/(app)/goods-receipts/page.tsx"
git commit -m "feat(warehouse): goods receipts list page + status filter

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Approval page + approve/reject controls

**Files:**
- Create: `src/components/goods-receipts/ApprovalActions.tsx`
- Create: `src/app/(app)/approvals/page.tsx`

**Interfaces:**
- Consumes: `listPendingReceipts` (Task 3); `approveGoodsReceipt`, `rejectGoodsReceipt` (Task 4); `getCurrentUser`, `canManageInventory`; `receiptTotalQty`.
- Produces: the `/approvals` route.

- [ ] **Step 1: Write `ApprovalActions.tsx`**

Create `src/components/goods-receipts/ApprovalActions.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import {
  approveGoodsReceipt,
  rejectGoodsReceipt,
} from "@/app/(app)/goods-receipts/actions";

export function ApprovalActions({
  receiptId,
  code,
}: {
  receiptId: string;
  code: string;
}) {
  const t = useTranslations("approvals");
  const tc = useTranslations("common");
  const tg = useTranslations("goodsReceipts.toast");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    confirmMsg: string
  ) => {
    if (!window.confirm(confirmMsg)) return;
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast(tc("saved"));
        router.refresh();
      } else if (res.error === "notPending") {
        toast(tg("notPending"), "error");
        router.refresh();
      } else {
        toast(tc("retry"), "error");
      }
    });
  };

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          run(() => rejectGoodsReceipt(receiptId), t("confirmReject", { code }))
        }
      >
        {t("reject")}
      </Button>
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          run(() => approveGoodsReceipt(receiptId), t("confirmApprove", { code }))
        }
      >
        {t("approve")}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Write the Approval page**

Create `src/app/(app)/approvals/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { canManageInventory } from "@/lib/roles";
import { isSupabaseConfigured } from "@/lib/config";
import { listPendingReceipts, receiptTotalQty } from "@/lib/goodsReceipts";
import { ApprovalActions } from "@/components/goods-receipts/ApprovalActions";

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user.role)) redirect("/inventory");
  const t = await getTranslations("approvals");
  const tg = await getTranslations("goodsReceipts");

  const pending = isSupabaseConfigured() ? await listPendingReceipts() : [];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
      <p className="text-sm text-gray-500">{t("subtitle", { count: pending.length })}</p>

      {pending.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          {t("none")}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
            {t("receiptsHeading")}
          </h2>
          {pending.map((r) => (
            <Card key={r.id}>
              <CardHeader className="justify-between">
                <div>
                  <span className="text-sm font-bold text-gray-900">
                    {r.code ?? tg("detail")}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">{r.supplier}</span>
                </div>
                <ApprovalActions receiptId={r.id} code={r.code ?? ""} />
              </CardHeader>
              <CardBody className="text-xs text-gray-600">
                <div className="mb-2 flex gap-4 text-gray-500">
                  <span>{r.receipt_date}</span>
                  <span>
                    {tg("cols.qty")}: <b className="text-gray-800">{receiptTotalQty(r.items)}</b>
                  </span>
                  <span>
                    {tg("detailView.receivedBy")}: {r.received_by_name ?? "—"}
                  </span>
                </div>
                <ul className="flex flex-col gap-1">
                  {r.items.map((it) => (
                    <li key={it.id} className="flex justify-between">
                      <span className="text-gray-800">
                        {it.product_name}{" "}
                        <span className="text-gray-400">({it.product_code})</span>
                      </span>
                      <span className="font-semibold text-gray-900">
                        {it.qty} {it.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit && npx next build`
Expected: no type errors; build succeeds; route list includes `/goods-receipts`, `/goods-receipts/new`, `/goods-receipts/[id]`, `/goods-receipts/[id]/edit`, `/approvals`.

- [ ] **Step 4: Commit**

```bash
git add "src/components/goods-receipts/ApprovalActions.tsx" "src/app/(app)/approvals/page.tsx"
git commit -m "feat(warehouse): Approval page with approve/reject for goods receipts

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Full verification + manual QA

**Files:** none (verification only; fix-forward with a `fix(warehouse):` commit if a gate fails).

- [ ] **Step 1: Run the full automated gate**

Run: `npm test && npx tsc --noEmit && npx next build`
Expected: tests pass; no type errors; build succeeds with the new routes.

- [ ] **Step 2: Apply migration + manual QA on staging**

Apply `supabase/migrations/0009_goods_receipts.sql` to dev/staging Supabase (never prod directly). Then, as **admin/manager**:
- Create a goods receipt (supplier + 2 product lines) → lands on detail, status **Pending**; inventory unchanged.
- Open `/approvals` → the receipt is listed → **Approve** → toast; inventory `qty_on_hand` rises by each line's qty; `stock_movements` has one `reason='receipt'` row per line linked via `source_id`; receipt status **Approved**; it leaves the Approval list.
- Create another receipt → **Reject** on `/approvals` → status **Rejected**, inventory unchanged.
- Verify approve/reject on an already-decided receipt is a no-op with the "no longer pending" toast (open two tabs, or call twice).
- Edit + delete are available only while **Pending**.
- As **sales**: `/goods-receipts` and `/approvals` are absent from the sidebar and visiting them redirects to `/inventory`.

- [ ] **Step 3: Record QA outcome**

Append a "## QA outcome (Phase 2)" section to `docs/superpowers/specs/2026-07-09-warehouse-phase2-goods-receipt-design.md` stating what was verified, then commit:

```bash
git add docs/superpowers/specs/2026-07-09-warehouse-phase2-goods-receipt-design.md
git commit -m "docs(warehouse): Phase 2 QA outcome

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** tables + code trigger + approve RPC + RLS (Task 1); pure helpers + tests (Task 2); loaders incl. pending + product options (Task 3); create/update/delete/approve/reject actions with role checks + `not_pending` mapping (Task 4); i18n en/th (Task 5); per-item nav roles + Goods Receipt/Approval items gated to manager/admin (Task 6); form + new/edit/detail pages with pending-only edit (Task 7); list + status filter (Task 8); Approval page + approve/reject controls (Task 9); automated gate + manual QA incl. idempotent approve, reject, sales-blocked (Task 10). Non-goals (Disbursement, supplier master, PO module, un-approve) not built.
- **Types:** `ReceiptFormState`, `GoodsReceiptStatus`, `GoodsReceiptRow`, `GoodsReceiptDetail`, `GoodsReceiptItemDetail`, `ProductOption`, `ReceiptFormInitial` are defined once and consumed with matching names/shapes. `approveGoodsReceipt(id)`/`rejectGoodsReceipt(id)` signatures are consistent across Tasks 4 and 9. The RPC name `approve_goods_receipt` and param `p_receipt_id` match between the migration (Task 1) and the action (Task 4).
- **Client/server boundary:** client components (`ReceiptStatusBadge`, `GoodsReceiptForm`, `ReceiptFilters`, `ApprovalActions`) import status metadata/types from `@/lib/goodsReceipts-shared` (pure); only server components/actions import `@/lib/goodsReceipts`. `GoodsReceiptForm` imports the `ProductOption` type from `@/lib/goodsReceipts` — a type-only import erased at build, so no server code enters the client bundle. Task 9 runs `next build` to confirm.
