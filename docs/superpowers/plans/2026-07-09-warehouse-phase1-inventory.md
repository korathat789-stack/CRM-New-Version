# Warehouse Phase 1 — Inventory + Product Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Warehouse "Inventory" module: a product/SKU master with current stock, an inventory list with status + value, product create/edit, and manual stock adjustment backed by an append-only ledger.

**Architecture:** New Supabase tables `products` + `stock_movements` (ledger; a trigger keeps `products.qty_on_hand` in sync and blocks negative stock). A new `/inventory` route group (list, new, edit) plus server actions, following the existing `projects`/`settings-catalog` patterns. New "Warehouse" sidebar group. Stock status/value are derived in a pure `src/lib/inventory.ts` helper (unit-tested).

**Tech Stack:** Next.js App Router (server components + server actions), TypeScript (strict), Supabase (Postgres + RLS), next-intl (en/th), Tailwind, lucide-react. Tests: `node --test` via `tsx`.

## Global Constraints

- Money is stored as integer **satang** (bigint); convert with `parseBahtToSatang` / `formatBahtShort` from `@/lib/money`. Never store floats.
- All new tables get RLS: `select` to `authenticated` (`using (true)`); `insert`/`update` gated to `public.is_manager_or_admin()`. `stock_movements` is append-only (no update/delete policy).
- Server actions enforce role in code too: read `getCurrentUser()`, reject when `role` is not `admin`/`manager`. Hiding UI never grants security.
- No `any`. Every user-facing string goes through next-intl in **both** `messages/en.json` and `messages/th.json`.
- Follow existing file patterns exactly (see referenced files in each task). Do NOT refactor unrelated code.
- Product categories are the fixed set: `rfid_readers`, `antennas`, `tags`, `printers`, `networking`, `accessories`, `software`.
- Stock status rule (verbatim): `out` when `qty_on_hand <= 0`; else `low` when `qty_on_hand <= safety_stock`; else `in_stock`.
- Every task ends green: `npx tsc --noEmit` (and `npm test` where tests exist) must pass before commit.
- Commit messages end with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer. Do not push.

---

### Task 1: Database migration — products + stock_movements + ledger trigger + RLS

**Files:**
- Create: `supabase/migrations/0008_warehouse.sql`

**Interfaces:**
- Consumes: existing SQL helpers from `0002_mpt_crm_core.sql` — `public.set_updated_at()`, `public.is_manager_or_admin()`, `public.profiles`.
- Produces: tables `public.products`, `public.stock_movements`; enum `public.product_category`; trigger that maintains `products.qty_on_hand` and raises `insufficient_stock`.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0008_warehouse.sql`:

```sql
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
```

- [ ] **Step 2: Sanity-check the SQL parses**

Run: `node -e "const s=require('fs').readFileSync('supabase/migrations/0008_warehouse.sql','utf8'); if(!/create table if not exists public\.products/.test(s)||!/create trigger stock_movements_apply/.test(s)) throw new Error('missing DDL'); console.log('migration DDL present')"`
Expected: `migration DDL present`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_warehouse.sql
git commit -m "feat(warehouse): products + stock_movements schema, ledger trigger, RLS

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

> **Note:** Applying the migration to Supabase (via `scripts/deploy-supabase.ps1` or the Supabase CLI) is a manual/deploy step verified in Task 9 QA, not in this session.

---

### Task 2: Pure inventory helpers + unit tests (TDD)

**Files:**
- Create: `src/lib/inventory.ts`
- Modify: `src/lib/__tests__/lib.test.ts` (append a section)

**Interfaces:**
- Produces:
  - `type ProductCategory = "rfid_readers"|"antennas"|"tags"|"printers"|"networking"|"accessories"|"software"`
  - `type StockStatus = "in_stock" | "low" | "out"`
  - `function stockStatus(qtyOnHand: number, safetyStock: number): StockStatus`
  - `function stockValue(qtyOnHand: number, cost: number): number`
  - `const PRODUCT_CATEGORIES: { code: ProductCategory; labelKey: string }[]`
  - `const STOCK_STATUS_COLORS: Record<StockStatus, { bg: string; fg: string }>`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/lib.test.ts` (add the import near the other imports at the top, and the tests at the end):

```ts
import { stockStatus, stockValue } from "../inventory";

// ---------------------------------------------------------------- inventory
test("inventory: stock status from qty vs safety", () => {
  assert.equal(stockStatus(0, 3), "out");   // zero → out
  assert.equal(stockStatus(3, 3), "low");   // at safety → low
  assert.equal(stockStatus(2, 3), "low");   // below safety → low
  assert.equal(stockStatus(4, 3), "in_stock");
  assert.equal(stockStatus(5, 0), "in_stock"); // no safety set
  assert.equal(stockStatus(0, 0), "out");
});

test("inventory: stock value is qty x cost in satang", () => {
  assert.equal(stockValue(8, 5_200_000), 41_600_000);
  assert.equal(stockValue(0, 5_200_000), 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../inventory` (or `stockStatus is not a function`).

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/inventory.ts`:

```ts
// Warehouse inventory: pure helpers + category/status metadata. Data loaders
// live below (Task 3). Money is in satang. Stock status thresholds live here so
// the rule is defined once.

export type ProductCategory =
  | "rfid_readers"
  | "antennas"
  | "tags"
  | "printers"
  | "networking"
  | "accessories"
  | "software";

export type StockStatus = "in_stock" | "low" | "out";

/** Out when nothing on hand; low when at/under the safety threshold. */
export function stockStatus(qtyOnHand: number, safetyStock: number): StockStatus {
  if (qtyOnHand <= 0) return "out";
  if (qtyOnHand <= safetyStock) return "low";
  return "in_stock";
}

/** On-hand stock value in satang. */
export function stockValue(qtyOnHand: number, cost: number): number {
  return qtyOnHand * cost;
}

export const PRODUCT_CATEGORIES: { code: ProductCategory; labelKey: string }[] = [
  { code: "rfid_readers", labelKey: "inventory.category.rfid_readers" },
  { code: "antennas", labelKey: "inventory.category.antennas" },
  { code: "tags", labelKey: "inventory.category.tags" },
  { code: "printers", labelKey: "inventory.category.printers" },
  { code: "networking", labelKey: "inventory.category.networking" },
  { code: "accessories", labelKey: "inventory.category.accessories" },
  { code: "software", labelKey: "inventory.category.software" },
];

export const STOCK_STATUS_COLORS: Record<StockStatus, { bg: string; fg: string }> = {
  in_stock: { bg: "#dcfce7", fg: "#15803d" },
  low: { bg: "#fef9c3", fg: "#a16207" },
  out: { bg: "#fee2e2", fg: "#b91c1c" },
};

export function isProductCategory(v: string): v is ProductCategory {
  return PRODUCT_CATEGORIES.some((c) => c.code === v);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (all tests, including the new inventory ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/inventory.ts src/lib/__tests__/lib.test.ts
git commit -m "feat(warehouse): stock status/value helpers + category metadata (tested)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Inventory data loaders (list + summary + detail)

**Files:**
- Modify: `src/lib/inventory.ts` (append types + loaders)

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`; `stockStatus`, `stockValue`, `ProductCategory`, `StockStatus` from this file.
- Produces:
  - `interface ProductRow { id, code, name, category, unit, cost, sell_price, qty_on_hand, safety_stock, is_active }`
  - `interface ProductDetail extends ProductRow { description: string | null; datasheet_url: string | null }`
  - `interface InventorySummary { skuCount: number; lowOutCount: number; stockValue: number }`
  - `interface ProductListFilters { q?: string; category?: string; status?: string }`
  - `interface ProductListResult { rows: ProductRow[]; summary: InventorySummary }`
  - `async function listProducts(filters: ProductListFilters): Promise<ProductListResult>`
  - `async function getProduct(id: string): Promise<ProductDetail | null>`

- [ ] **Step 1: Append types + loaders to `src/lib/inventory.ts`**

Add at the top of the file (below the existing header comment):

```ts
import { createClient } from "./supabase/server";
```

Append at the end of the file:

```ts
export interface ProductRow {
  id: string;
  code: string;
  name: string;
  category: ProductCategory;
  unit: string;
  cost: number; // satang
  sell_price: number; // satang
  qty_on_hand: number;
  safety_stock: number;
  is_active: boolean;
}

export interface ProductDetail extends ProductRow {
  description: string | null;
  datasheet_url: string | null;
}

export interface InventorySummary {
  skuCount: number;
  lowOutCount: number;
  stockValue: number; // satang
}

export interface ProductListFilters {
  q?: string;
  category?: string;
  status?: string; // "all" | StockStatus
}

export interface ProductListResult {
  rows: ProductRow[];
  summary: InventorySummary;
}

const PRODUCT_COLS =
  "id, code, name, category, unit, cost, sell_price, qty_on_hand, safety_stock, is_active";

export async function listProducts(
  filters: ProductListFilters
): Promise<ProductListResult> {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select(PRODUCT_COLS)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (filters.category && isProductCategory(filters.category)) {
    query = query.eq("category", filters.category);
  }
  if (filters.q && filters.q.trim()) {
    const term = `%${filters.q.trim()}%`;
    query = query.or(`name.ilike.${term},code.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  let rows = (data ?? []) as ProductRow[];

  // Status is derived, so filter it in memory.
  if (filters.status && filters.status !== "all") {
    rows = rows.filter(
      (r) => stockStatus(r.qty_on_hand, r.safety_stock) === filters.status
    );
  }

  const summary: InventorySummary = {
    skuCount: rows.length,
    lowOutCount: rows.filter(
      (r) => stockStatus(r.qty_on_hand, r.safety_stock) !== "in_stock"
    ).length,
    stockValue: rows.reduce((sum, r) => sum + stockValue(r.qty_on_hand, r.cost), 0),
  };

  return { rows, summary };
}

export async function getProduct(id: string): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(`${PRODUCT_COLS}, description, datasheet_url`)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as ProductDetail;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/inventory.ts
git commit -m "feat(warehouse): product list/summary/detail loaders

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Server actions — create/update/delete product + adjust stock

**Files:**
- Create: `src/app/(app)/inventory/actions.ts`

**Interfaces:**
- Consumes: `getCurrentUser` from `@/lib/auth`; `createClient` from `@/lib/supabase/server`; `parseBahtToSatang` from `@/lib/money`; `isProductCategory` from `@/lib/inventory`.
- Produces:
  - `interface ProductFormState { ok: boolean; error?: string }`
  - `async function createProduct(prev: ProductFormState, formData: FormData): Promise<ProductFormState>` (redirects to `/inventory/<id>` on success)
  - `async function updateProduct(prev: ProductFormState, formData: FormData): Promise<ProductFormState>` (reads `id` from formData; redirects to `/inventory/<id>`)
  - `async function deleteProduct(id: string): Promise<{ ok: boolean; error?: string }>`
  - `async function adjustStock(productId: string, qtyDelta: number, note: string): Promise<{ ok: boolean; error?: string }>`

- [ ] **Step 1: Write the actions file**

Create `src/app/(app)/inventory/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { parseBahtToSatang } from "@/lib/money";
import { isProductCategory } from "@/lib/inventory";

export interface ProductFormState {
  ok: boolean;
  error?: string;
}

// manager/admin only. Returns the user when allowed, else null.
async function requireManager() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin" && user.role !== "manager") return null;
  return user;
}

function readProduct(formData: FormData) {
  const category = String(formData.get("category") ?? "");
  return {
    code: String(formData.get("code") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    category,
    unit: String(formData.get("unit") ?? "").trim() || "unit",
    cost: parseBahtToSatang(String(formData.get("cost") ?? "")) ?? 0,
    sell_price: parseBahtToSatang(String(formData.get("sell_price") ?? "")) ?? 0,
    safety_stock: Math.max(0, parseInt(String(formData.get("safety_stock") ?? "0"), 10) || 0),
    description: String(formData.get("description") ?? "").trim() || null,
    is_active: String(formData.get("is_active") ?? "true") !== "false",
  };
}

export async function createProduct(
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const user = await requireManager();
  if (!user) return { ok: false, error: "forbidden" };

  const input = readProduct(formData);
  if (!input.code || !input.name || !isProductCategory(input.category)) {
    return { ok: false, error: "required" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({ ...input, created_by: user.id })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "duplicate" };
    return { ok: false, error: error.message };
  }

  revalidatePath("/inventory");
  redirect(`/inventory/${data.id}`);
}

export async function updateProduct(
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const user = await requireManager();
  if (!user) return { ok: false, error: "forbidden" };

  const id = String(formData.get("id") ?? "");
  const input = readProduct(formData);
  if (!id || !input.code || !input.name || !isProductCategory(input.category)) {
    return { ok: false, error: "required" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("products").update(input).eq("id", id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "duplicate" };
    return { ok: false, error: error.message };
  }

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  redirect(`/inventory/${id}`);
}

export async function deleteProduct(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireManager();
  if (!user) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory");
  return { ok: true };
}

export async function adjustStock(
  productId: string,
  qtyDelta: number,
  note: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireManager();
  if (!user) return { ok: false, error: "forbidden" };
  if (!productId || !Number.isInteger(qtyDelta) || qtyDelta === 0) {
    return { ok: false, error: "invalid" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("stock_movements").insert({
    product_id: productId,
    qty_delta: qtyDelta,
    reason: "adjustment",
    source_type: "adjustment",
    note: note.trim() || null,
    created_by: user.id,
  });

  if (error) {
    if (error.message.includes("insufficient_stock")) {
      return { ok: false, error: "insufficient" };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/inventory");
  return { ok: true };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/inventory/actions.ts"
git commit -m "feat(warehouse): product + stock-adjust server actions (manager/admin)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: i18n strings (en + th)

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/th.json`

**Interfaces:**
- Produces: `nav.group.warehouse`, `nav.inventory`, and the `inventory.*` block consumed by Tasks 6–8.

- [ ] **Step 1: Add nav keys**

In `messages/en.json`, inside the existing `"nav"` object add:

```json
"inventory": "Inventory",
```

and inside `nav.group` add:

```json
"warehouse": "Warehouse",
```

In `messages/th.json`, `nav`:

```json
"inventory": "คลังสินค้า",
```

and `nav.group`:

```json
"warehouse": "คลังสินค้า",
```

- [ ] **Step 2: Add the `inventory` block**

Add a top-level `"inventory"` object to `messages/en.json`:

```json
"inventory": {
  "title": "Inventory",
  "subtitle": "{count} products",
  "newProduct": "New product",
  "editProduct": "Edit product",
  "noProducts": "No products yet.",
  "search": "Search SKU or name",
  "summary": {
    "skus": "Total SKUs",
    "lowOut": "Low / Out",
    "stockValue": "Stock Value"
  },
  "cols": {
    "sku": "SKU",
    "name": "Product",
    "category": "Category",
    "qty": "On hand",
    "status": "Status",
    "value": "Stock value",
    "cost": "Cost",
    "sell": "Sell"
  },
  "status": {
    "all": "All statuses",
    "in_stock": "In Stock",
    "low": "Low",
    "out": "Out of stock"
  },
  "category": {
    "all": "All categories",
    "rfid_readers": "RFID Readers",
    "antennas": "Antennas",
    "tags": "Tags",
    "printers": "Printers",
    "networking": "Networking",
    "accessories": "Accessories",
    "software": "Software"
  },
  "form": {
    "title": "Product",
    "code": "SKU",
    "name": "Name",
    "category": "Category",
    "unit": "Unit",
    "cost": "Cost (฿)",
    "sell": "Sell price (฿)",
    "safety": "Safety stock",
    "description": "Description",
    "active": "Active",
    "save": "Save product",
    "required": "Please fill in SKU, name and category.",
    "duplicate": "That SKU already exists."
  },
  "adjust": {
    "title": "Adjust stock",
    "action": "Adjust",
    "delta": "Change (+/-)",
    "note": "Reason / note",
    "save": "Apply",
    "insufficient": "Not enough stock for this change.",
    "invalid": "Enter a non-zero whole number."
  },
  "deleteConfirm": "Delete this product?"
}
```

Add the same object to `messages/th.json` with Thai values:

```json
"inventory": {
  "title": "คลังสินค้า",
  "subtitle": "{count} รายการสินค้า",
  "newProduct": "เพิ่มสินค้า",
  "editProduct": "แก้ไขสินค้า",
  "noProducts": "ยังไม่มีสินค้า",
  "search": "ค้นหา SKU หรือชื่อ",
  "summary": {
    "skus": "จำนวน SKU",
    "lowOut": "ใกล้หมด / หมด",
    "stockValue": "มูลค่าสต็อก"
  },
  "cols": {
    "sku": "SKU",
    "name": "สินค้า",
    "category": "หมวด",
    "qty": "คงเหลือ",
    "status": "สถานะ",
    "value": "มูลค่าสต็อก",
    "cost": "ต้นทุน",
    "sell": "ราคาขาย"
  },
  "status": {
    "all": "ทุกสถานะ",
    "in_stock": "มีสต็อก",
    "low": "ใกล้หมด",
    "out": "หมดสต็อก"
  },
  "category": {
    "all": "ทุกหมวด",
    "rfid_readers": "เครื่องอ่าน RFID",
    "antennas": "เสาอากาศ",
    "tags": "แท็ก",
    "printers": "เครื่องพิมพ์",
    "networking": "อุปกรณ์เครือข่าย",
    "accessories": "อุปกรณ์เสริม",
    "software": "ซอฟต์แวร์"
  },
  "form": {
    "title": "สินค้า",
    "code": "SKU",
    "name": "ชื่อ",
    "category": "หมวด",
    "unit": "หน่วย",
    "cost": "ต้นทุน (฿)",
    "sell": "ราคาขาย (฿)",
    "safety": "สต็อกปลอดภัย",
    "description": "รายละเอียด",
    "active": "ใช้งาน",
    "save": "บันทึกสินค้า",
    "required": "กรุณากรอก SKU ชื่อ และหมวด",
    "duplicate": "SKU นี้มีอยู่แล้ว"
  },
  "adjust": {
    "title": "ปรับสต็อก",
    "action": "ปรับ",
    "delta": "จำนวนที่เปลี่ยน (+/-)",
    "note": "เหตุผล / หมายเหตุ",
    "save": "ยืนยัน",
    "insufficient": "สต็อกไม่พอสำหรับการปรับนี้",
    "invalid": "กรอกจำนวนเต็มที่ไม่ใช่ศูนย์"
  },
  "deleteConfirm": "ลบสินค้านี้?"
}
```

- [ ] **Step 3: Verify both files still parse**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8'));JSON.parse(require('fs').readFileSync('messages/th.json','utf8'));console.log('json ok')"`
Expected: `json ok`

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/th.json
git commit -m "i18n(warehouse): inventory + nav strings (en/th)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Sidebar navigation — Warehouse group + Inventory item

**Files:**
- Modify: `src/lib/roles.ts`
- Modify: `src/components/shell/Sidebar.tsx`

**Interfaces:**
- Consumes: i18n keys `nav.group.warehouse`, `nav.inventory` (Task 5).
- Produces: `warehouse` group in `NAV`; `canManageInventory(role)`; `Package` icon registered in `Sidebar` `ICONS`.

- [ ] **Step 1: Extend the nav model in `src/lib/roles.ts`**

Change the `NavGroupId` type to include `warehouse`:

```ts
export type NavGroupId = "main" | "warehouse" | "reports" | "admin";
```

Insert a new group into the `NAV` array, **after** the `main` group and before `reports`:

```ts
  {
    id: "warehouse",
    labelKey: "nav.group.warehouse",
    roles: ["admin", "manager", "sales"],
    items: [
      { href: "/inventory", labelKey: "nav.inventory", icon: "Package" },
    ],
  },
```

Add a permission helper near `canDelete`:

```ts
/** Can create/edit products and adjust stock. */
export function canManageInventory(role: Role): boolean {
  return role === "admin" || role === "manager";
}
```

- [ ] **Step 2: Register the `Package` icon in `src/components/shell/Sidebar.tsx`**

Add `Package` to the lucide import list:

```ts
  Upload,
  Package,
  Settings,
```

Add it to the `ICONS` map:

```ts
  Upload,
  Package,
  Settings,
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/roles.ts src/components/shell/Sidebar.tsx
git commit -m "feat(warehouse): Warehouse nav group + Inventory link + canManageInventory

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: ProductForm + new/edit pages

**Files:**
- Create: `src/components/inventory/ProductForm.tsx`
- Create: `src/app/(app)/inventory/new/page.tsx`
- Create: `src/app/(app)/inventory/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `createProduct`, `updateProduct`, `ProductFormState` (Task 4); `getProduct`, `PRODUCT_CATEGORIES` (Tasks 2–3); `Card`/`CardBody`/`CardHeader`, `Button`.
- Produces: `<ProductForm mode="new" | "edit" initial? />` component; the two routes.

- [ ] **Step 1: Write `ProductForm.tsx`**

Create `src/components/inventory/ProductForm.tsx` (pattern mirrors `ProjectForm`):

```tsx
"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PRODUCT_CATEGORIES } from "@/lib/inventory";
import {
  createProduct,
  updateProduct,
  type ProductFormState,
} from "@/app/(app)/inventory/actions";

const INITIAL: ProductFormState = { ok: false };

export interface ProductFormInitial {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  cost: string;
  sell_price: string;
  safety_stock: string;
  description: string;
  is_active: boolean;
}

export function ProductForm({
  mode,
  initial,
}: {
  mode: "new" | "edit";
  initial?: ProductFormInitial;
}) {
  const t = useTranslations("inventory.form");
  const tc = useTranslations("common");
  const ts = useTranslations();
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    mode === "new" ? createProduct : updateProduct,
    INITIAL
  );

  const errorText =
    state.error === "duplicate"
      ? t("duplicate")
      : state.error
        ? t("required")
        : null;

  return (
    <form action={formAction} className="mx-auto max-w-xl">
      {mode === "edit" && <input type="hidden" name="id" value={initial?.id} />}
      <Card>
        <CardHeader>
          <span className="text-base font-bold text-gray-900">{t("title")}</span>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("code")} required>
              <input name="code" defaultValue={initial?.code} className="input" />
            </Field>
            <Field label={t("category")} required>
              <select name="category" defaultValue={initial?.category ?? ""} className="input">
                <option value="">—</option>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {ts(c.labelKey)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={t("name")} required>
            <input name="name" defaultValue={initial?.name} className="input" />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t("unit")}>
              <input name="unit" defaultValue={initial?.unit ?? "unit"} className="input" />
            </Field>
            <Field label={t("cost")}>
              <input name="cost" defaultValue={initial?.cost} inputMode="numeric" placeholder="0" className="input text-right" />
            </Field>
            <Field label={t("sell")}>
              <input name="sell_price" defaultValue={initial?.sell_price} inputMode="numeric" placeholder="0" className="input text-right" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("safety")}>
              <input name="safety_stock" defaultValue={initial?.safety_stock ?? "0"} inputMode="numeric" placeholder="0" className="input text-right" />
            </Field>
            <label className="flex items-center gap-2 pt-6">
              <input type="checkbox" name="is_active" value="true" defaultChecked={initial?.is_active ?? true} />
              <span className="text-xs font-semibold text-gray-600">{t("active")}</span>
            </label>
          </div>

          <Field label={t("description")}>
            <textarea name="description" defaultValue={initial?.description} rows={2} className="input" />
          </Field>

          {errorText && (
            <div className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]">
              {errorText}
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

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-gray-600">
        {label} {required && <span className="text-[#dc2626]">*</span>}
      </span>
      {children}
    </label>
  );
}
```

> Note: for `is_active`, an unchecked checkbox submits nothing, so `readProduct` treats a missing value as `true` only when the field default is true. To make "unchecked = inactive" work on edit, a hidden fallback is added in the page below. Keep the checkbox `value="true"`; the action reads `is_active !== "false"`.

Because an unchecked checkbox omits the field entirely, add a hidden input **before** the checkbox so unchecking yields `false`:

```tsx
            <label className="flex items-center gap-2 pt-6">
              <input type="hidden" name="is_active" value="false" />
              <input type="checkbox" name="is_active" value="true" defaultChecked={initial?.is_active ?? true} />
              <span className="text-xs font-semibold text-gray-600">{t("active")}</span>
            </label>
```

(When checked, the browser submits both `false` and `true`; `FormData.get` returns the **first** value. So the action must read the LAST value. Update `readProduct` in Task 4's file accordingly — see Step 2.)

- [ ] **Step 2: Fix `is_active` parsing to use the last value**

In `src/app/(app)/inventory/actions.ts`, change the `is_active` line in `readProduct` to read all values and take the last:

```ts
    is_active: (formData.getAll("is_active").at(-1) ?? "true") !== "false",
```

- [ ] **Step 3: Write the new-product page**

Create `src/app/(app)/inventory/new/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageInventory } from "@/lib/roles";
import { ProductForm } from "@/components/inventory/ProductForm";

export default async function NewProductPage() {
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user.role)) redirect("/inventory");
  const t = await getTranslations("inventory");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold text-gray-900">{t("newProduct")}</h1>
      <ProductForm mode="new" />
    </div>
  );
}
```

- [ ] **Step 4: Write the edit-product page**

Create `src/app/(app)/inventory/[id]/edit/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageInventory } from "@/lib/roles";
import { getProduct } from "@/lib/inventory";
import { formatMoney2 } from "@/lib/money";
import { ProductForm } from "@/components/inventory/ProductForm";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user.role)) redirect("/inventory");

  const product = await getProduct(id);
  if (!product) notFound();
  const t = await getTranslations("inventory");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold text-gray-900">{t("editProduct")}</h1>
      <ProductForm
        mode="edit"
        initial={{
          id: product.id,
          code: product.code,
          name: product.name,
          category: product.category,
          unit: product.unit,
          cost: formatMoney2(product.cost),
          sell_price: formatMoney2(product.sell_price),
          safety_stock: String(product.safety_stock),
          description: product.description ?? "",
          is_active: product.is_active,
        }}
      />
    </div>
  );
}
```

> `formatMoney2(satang)` returns a plain baht number string (e.g. `52000.00`), which `parseBahtToSatang` round-trips back to satang.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/components/inventory/ProductForm.tsx" "src/app/(app)/inventory/new/page.tsx" "src/app/(app)/inventory/[id]/edit/page.tsx" "src/app/(app)/inventory/actions.ts"
git commit -m "feat(warehouse): ProductForm + new/edit product pages

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Inventory list page + filters + stock adjuster

**Files:**
- Create: `src/components/inventory/InventoryFilters.tsx`
- Create: `src/components/inventory/StockAdjuster.tsx`
- Create: `src/app/(app)/inventory/page.tsx`

**Interfaces:**
- Consumes: `listProducts`, `stockStatus`, `STOCK_STATUS_COLORS`, `PRODUCT_CATEGORIES` (Tasks 2–3); `adjustStock`, `deleteProduct` (Task 4); `getCurrentUser`, `canManageInventory`; `formatBahtShort`; `isSupabaseConfigured`; `toast`.
- Produces: the `/inventory` list route.

- [ ] **Step 1: Write `InventoryFilters.tsx`** (mirrors `ProjectFilters`)

Create `src/components/inventory/InventoryFilters.tsx`:

```tsx
"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { PRODUCT_CATEGORIES } from "@/lib/inventory";

interface Props {
  q: string;
  category: string;
  status: string;
}

export function InventoryFilters({ q, category, status }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useTranslations("inventory");
  const ts = useTranslations();
  const [, startTransition] = useTransition();

  const update = (key: string, val: string) => {
    const next = new URLSearchParams(params);
    if (!val || val === "all") next.delete(key);
    else next.set(key, val);
    startTransition(() =>
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1.5">
        <Search className="h-4 w-4 text-gray-400" aria-hidden />
        <input
          defaultValue={q}
          onChange={(e) => update("q", e.target.value)}
          placeholder={t("search")}
          className="w-full bg-transparent text-sm outline-none"
          aria-label={t("search")}
        />
      </div>

      <label className="flex items-center gap-1.5 rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs text-gray-600">
        <span className="font-semibold">{t("cols.category")}:</span>
        <select
          value={category}
          onChange={(e) => update("category", e.target.value)}
          className="bg-transparent text-xs outline-none"
        >
          <option value="all">{t("category.all")}</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c.code} value={c.code}>
              {ts(c.labelKey)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs text-gray-600">
        <span className="font-semibold">{t("cols.status")}:</span>
        <select
          value={status}
          onChange={(e) => update("status", e.target.value)}
          className="bg-transparent text-xs outline-none"
        >
          <option value="all">{t("status.all")}</option>
          <option value="in_stock">{t("status.in_stock")}</option>
          <option value="low">{t("status.low")}</option>
          <option value="out">{t("status.out")}</option>
        </select>
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Write `StockAdjuster.tsx`**

Create `src/components/inventory/StockAdjuster.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import { adjustStock } from "@/app/(app)/inventory/actions";

export function StockAdjuster({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const t = useTranslations("inventory.adjust");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const qty = parseInt(amount, 10);
    if (!Number.isInteger(qty) || qty <= 0) {
      toast(t("invalid"), "error");
      return;
    }
    startTransition(async () => {
      const res = await adjustStock(productId, sign * qty, note);
      if (res.ok) {
        toast(tc("saved"));
        setOpen(false);
        setAmount("");
        setNote("");
        router.refresh();
      } else {
        toast(t(res.error === "insufficient" ? "insufficient" : "invalid"), "error");
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-[var(--color-line)] px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
      >
        {t("action")}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl">
        <div className="mb-3 text-sm font-bold text-gray-900">
          {t("title")} — {productName}
        </div>
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSign(1)}
            className={`flex h-9 w-9 items-center justify-center rounded-md border ${sign === 1 ? "border-[var(--color-primary)] bg-blue-50" : "border-[var(--color-line)]"}`}
            aria-label="add"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setSign(-1)}
            className={`flex h-9 w-9 items-center justify-center rounded-md border ${sign === -1 ? "border-[var(--color-primary)] bg-blue-50" : "border-[var(--color-line)]"}`}
            aria-label="subtract"
          >
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
            placeholder={t("delta")}
            className="input flex-1 text-right"
            aria-label={t("delta")}
          />
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("note")}
          className="input mb-3 w-full"
          aria-label={t("note")}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {tc("cancel")}
          </Button>
          <Button type="button" disabled={pending} onClick={submit}>
            {t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the list page `src/app/(app)/inventory/page.tsx`**

```tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus, Pencil } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/states/StateViews";
import { InventoryFilters } from "@/components/inventory/InventoryFilters";
import { StockAdjuster } from "@/components/inventory/StockAdjuster";
import {
  listProducts,
  stockStatus,
  stockValue,
  STOCK_STATUS_COLORS,
  type ProductRow,
} from "@/lib/inventory";
import { getCurrentUser } from "@/lib/auth";
import { canManageInventory } from "@/lib/roles";
import { isSupabaseConfigured } from "@/lib/config";
import { formatBahtShort } from "@/lib/money";

const GRID = "grid grid-cols-[2fr_1fr_0.8fr_0.9fr_1fr_0.9fr] gap-2 items-center";

type SP = { q?: string; category?: string; status?: string };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const t = await getTranslations("inventory");
  const user = await getCurrentUser();
  const canManage = !!user && canManageInventory(user.role);

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
        <div className="mt-4">
          <EmptyState />
        </div>
      </div>
    );
  }

  const { rows, summary } = await listProducts({
    q: sp.q,
    category: sp.category,
    status: sp.status,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">
            {t("subtitle", { count: summary.skuCount })}
          </p>
        </div>
        {canManage && (
          <Link href="/inventory/new">
            <Button>
              <Plus className="h-4 w-4" aria-hidden />
              {t("newProduct")}
            </Button>
          </Link>
        )}
      </div>

      {/* Summary cards */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label={t("summary.skus")} value={String(summary.skuCount)} />
        <SummaryCard label={t("summary.lowOut")} value={String(summary.lowOutCount)} />
        <SummaryCard label={t("summary.stockValue")} value={formatBahtShort(summary.stockValue)} />
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-[var(--color-line)] bg-gray-50 p-3">
          <InventoryFilters
            q={sp.q ?? ""}
            category={sp.category ?? "all"}
            status={sp.status ?? "all"}
          />
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">{t("noProducts")}</div>
        ) : (
          <div className="hidden md:block">
            <div className={`${GRID} border-b border-[var(--color-line)] bg-gray-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-gray-500`}>
              <div>{t("cols.name")}</div>
              <div>{t("cols.category")}</div>
              <div className="text-right">{t("cols.qty")}</div>
              <div>{t("cols.status")}</div>
              <div className="text-right">{t("cols.value")}</div>
              <div />
            </div>
            {rows.map((p) => (
              <Row key={p.id} p={p} canManage={canManage} t={t} />
            ))}
          </div>
        )}

        {/* Mobile cards */}
        {rows.length > 0 && (
          <div className="md:hidden">
            {rows.map((p) => (
              <MobileRow key={p.id} p={p} canManage={canManage} t={t} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold text-gray-900">{value}</div>
    </Card>
  );
}

function StatusBadge({ status, label }: { status: "in_stock" | "low" | "out"; label: string }) {
  const c = STOCK_STATUS_COLORS[status];
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: c.bg, color: c.fg }}
    >
      {label}
    </span>
  );
}

function Row({
  p,
  canManage,
  t,
}: {
  p: ProductRow;
  canManage: boolean;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const status = stockStatus(p.qty_on_hand, p.safety_stock);
  return (
    <div className={`${GRID} border-b border-[var(--color-line-soft)] px-4 py-2.5 text-xs`}>
      <div>
        <div className="font-semibold text-gray-900">{p.name}</div>
        <div className="text-[10px] text-gray-400">{p.code}</div>
      </div>
      <div className="text-gray-700">{t(`category.${p.category}`)}</div>
      <div className="text-right font-bold text-gray-900">
        {p.qty_on_hand} {p.unit}
      </div>
      <div>
        <StatusBadge status={status} label={t(`status.${status}`)} />
      </div>
      <div className="text-right text-gray-700">
        {formatBahtShort(stockValue(p.qty_on_hand, p.cost))}
      </div>
      <div className="flex items-center justify-end gap-2">
        {canManage && <StockAdjuster productId={p.id} productName={p.name} />}
        {canManage && (
          <Link href={`/inventory/${p.id}/edit`} className="text-gray-400 hover:text-[var(--color-primary)]" aria-label={t("editProduct")}>
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}

function MobileRow({
  p,
  canManage,
  t,
}: {
  p: ProductRow;
  canManage: boolean;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const status = stockStatus(p.qty_on_hand, p.safety_stock);
  return (
    <div className="flex flex-col gap-2 border-b border-[var(--color-line-soft)] p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-gray-900">{p.name}</div>
          <div className="text-[10px] text-gray-400">{p.code}</div>
        </div>
        <StatusBadge status={status} label={t(`status.${status}`)} />
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">{t("cols.qty")}</span>
        <b>{p.qty_on_hand} {p.unit}</b>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">{t("cols.value")}</span>
        <b>{formatBahtShort(stockValue(p.qty_on_hand, p.cost))}</b>
      </div>
      {canManage && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <StockAdjuster productId={p.id} productName={p.name} />
          <Link href={`/inventory/${p.id}/edit`} className="rounded-md border border-[var(--color-line)] px-2 py-1 font-semibold text-gray-600">
            {t("editProduct")}
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Confirm the referenced helpers exist**

Run: `node -e "const s=require('fs').readFileSync('src/components/states/StateViews.tsx','utf8'); if(!/export function EmptyState/.test(s)) throw new Error('EmptyState missing'); console.log('EmptyState ok')"`
Expected: `EmptyState ok`
(If it fails, replace `<EmptyState />` with a plain `<div className="p-8 text-center text-sm text-gray-500">{t("noProducts")}</div>` and drop the import.)

- [ ] **Step 5: Type-check + build**

Run: `npx tsc --noEmit && npx next build`
Expected: no type errors; build succeeds; route list includes `/inventory`, `/inventory/new`, `/inventory/[id]/edit`.

- [ ] **Step 6: Commit**

```bash
git add "src/components/inventory/InventoryFilters.tsx" "src/components/inventory/StockAdjuster.tsx" "src/app/(app)/inventory/page.tsx"
git commit -m "feat(warehouse): inventory list page, filters, stock adjuster

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Full verification + manual QA

**Files:** none (verification only; fix-forward if a gate fails, committing fixes with a `fix(warehouse):` message).

- [ ] **Step 1: Run the full automated gate**

Run: `npm test && npx tsc --noEmit && npx next build`
Expected: tests pass; no type errors; build succeeds.

- [ ] **Step 2: Apply the migration to the dev/staging Supabase and manually QA**

Apply `supabase/migrations/0008_warehouse.sql` (via `scripts/deploy-supabase.ps1` or the Supabase CLI against the dev project — never production directly). Then, signed in as **admin/manager**:
- Create a product (SKU `RFID-FX-001`, category RFID Readers, cost 52000, safety 3) → lands on the list; appears with status **Out** (qty 0).
- Adjust stock **+10** → status becomes **In Stock**, stock value = qty × cost; summary cards update.
- Adjust stock **-20** → blocked with the "not enough stock" toast (negative guard).
- Adjust **-8** → qty 2, status **Low** (≤ safety 3).
- Edit the product, toggle **Active** off and on → persists.
- Create a second product with the **same SKU** → "SKU already exists" error.
- Filter by category and status, and search by name/SKU → list narrows correctly.

Signed in as **sales**:
- `/inventory` is visible and lists products, but there is **no** New/Edit/Adjust control.
- Visiting `/inventory/new` directly redirects to `/inventory`.

- [ ] **Step 3: Record QA outcome**

Append a short QA note to `docs/superpowers/specs/2026-07-09-warehouse-module-design.md` (a "## QA outcome (Phase 1)" section) stating what was verified and any follow-ups, then commit:

```bash
git add docs/superpowers/specs/2026-07-09-warehouse-module-design.md
git commit -m "docs(warehouse): Phase 1 QA outcome

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** products + stock_movements + trigger + RLS (Task 1); pure helpers + tests (Task 2); loaders + summary (Task 3); create/update/delete + adjust actions with role checks (Task 4); i18n en/th (Task 5); Warehouse nav group visible to all, edit gated (Task 6); ProductForm + new/edit (Task 7); list + filters + summary cards + adjuster, sales read-only (Task 8); automated gate + manual QA incl. negative-stock + duplicate-SKU + sales read-only (Task 9). Non-goals (GR/DSB/Approval, quotation integration, uploads, supplier master) are not built.
- **Types:** `ProductFormState`, `ProductRow`, `ProductDetail`, `StockStatus`, `ProductCategory`, `InventorySummary` are defined once (Tasks 2–4) and consumed by later tasks with the same names/shapes. `canManageInventory` is defined in Task 6 and used in Tasks 7–8. `adjustStock(productId, qtyDelta, note)` signature is consistent across Tasks 4 and 8.
- **is_active edge case** is handled explicitly (hidden `false` + checkbox `true`, action reads last value).
