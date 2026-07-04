# Design System / Shell Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the app shell (sidebar + top bar) and shared primitives with the MatchPoint CRM prototype without touching data or business logic.

**Architecture:** Two pure helpers (nav-title lookup, user initials) drive presentational changes. The `Topbar` (server component) gains a screen title via a small `ScreenTitle` client sub-component; the `Sidebar` (already a client component) gains a brand subtitle, an icon logo, and a user footer that owns logout. The `(app)` layout passes the full `user` into `Sidebar`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, next-intl, lucide-react. Tests: Node test runner (`node --import tsx --test`).

## Global Constraints

- Design tokens only — no hard-coded hexes in components; use `var(--color-*)` / Tailwind token classes. Standard radius `.65rem`.
- Keep Sarabun (Thai) + Inter (Latin) fonts; no font changes.
- No hard-coded UI strings — every visible label goes through next-intl (`messages/th.json` + `messages/en.json`, keys must exist in both).
- No DB / Supabase schema / migration / RLS changes.
- Do NOT add a notifications feature or a role switcher (out of scope; security).
- Preserve existing role-gating (`visibleNav`), active-route logic, a11y (visible focus rings, ~44px touch targets), and responsive behavior (sidebar is `hidden md:block` in the layout).
- TypeScript strict; avoid `any`.
- Tests live in `src/lib/__tests__/lib.test.ts` using `node:test` + `node:assert/strict`.

---

### Task 1: Pure helpers — nav title + user initials

**Files:**
- Modify: `src/lib/roles.ts` (add `navTitleKey`)
- Create: `src/lib/initials.ts`
- Test: `src/lib/__tests__/lib.test.ts` (append)

**Interfaces:**
- Produces: `navTitleKey(pathname: string): string` — returns an i18n key under `nav.*` for the current route (longest-prefix match, fallback `"nav.dashboard"`).
- Produces: `initialsFrom(fullName: string | null, email: string | null): string` — 1–2 uppercase letters, fallback `"?"`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/lib.test.ts`:

```ts
import { navTitleKey } from "../roles";
import { initialsFrom } from "../initials";

// ---------------------------------------------------------------- navTitleKey
test("navTitleKey: exact and nested routes map to the nav label", () => {
  assert.equal(navTitleKey("/dashboard"), "nav.dashboard");
  assert.equal(navTitleKey("/customers"), "nav.customers");
  assert.equal(navTitleKey("/customers/CUS-000001"), "nav.customers");
  assert.equal(navTitleKey("/customers/CUS-000001/edit"), "nav.customers");
});

test("navTitleKey: longest prefix wins for nested settings routes", () => {
  assert.equal(navTitleKey("/settings"), "nav.settings");
  assert.equal(navTitleKey("/settings/users"), "nav.users");
  assert.equal(navTitleKey("/settings/import"), "nav.import");
});

test("navTitleKey: unknown route falls back to dashboard", () => {
  assert.equal(navTitleKey("/nope"), "nav.dashboard");
});

// ---------------------------------------------------------------- initialsFrom
test("initialsFrom: uses up to two name words, uppercased", () => {
  assert.equal(initialsFrom("Somchai Prasert", "a@b.co"), "SP");
  assert.equal(initialsFrom("madonna", "a@b.co"), "M");
  assert.equal(initialsFrom("  ก ข ค ", "a@b.co"), "กข");
});

test("initialsFrom: falls back to email, then '?'", () => {
  assert.equal(initialsFrom(null, "korat@example.com"), "K");
  assert.equal(initialsFrom("", ""), "?");
  assert.equal(initialsFrom(null, null), "?");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `navTitleKey`/`initialsFrom` not exported (module/import errors).

- [ ] **Step 3: Implement `navTitleKey` in `src/lib/roles.ts`**

Append at the end of `src/lib/roles.ts` (uses the existing `NAV` constant and `NavItem` type):

```ts
/**
 * Map a pathname to the i18n label key of the nav item it belongs to, using a
 * longest-prefix match so nested routes (e.g. /customers/123) resolve to their
 * section. Falls back to the dashboard label for unknown routes.
 */
export function navTitleKey(pathname: string): string {
  let best: NavItem | null = null;
  for (const group of NAV) {
    for (const item of group.items) {
      const match =
        pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (match && (!best || item.href.length > best.href.length)) {
        best = item;
      }
    }
  }
  return best ? best.labelKey : "nav.dashboard";
}
```

- [ ] **Step 4: Implement `src/lib/initials.ts`**

```ts
/**
 * Derive 1–2 uppercase initials from a full name, falling back to the first
 * letter of the email, then "?". Works for Thai and Latin scripts.
 */
export function initialsFrom(
  fullName: string | null,
  email: string | null,
): string {
  const name = fullName?.trim();
  if (name) {
    const letters = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("");
    if (letters) return letters.toUpperCase();
  }
  const mail = email?.trim();
  if (mail) return mail[0].toUpperCase();
  return "?";
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all prior tests plus the 5 new ones (18 total).

- [ ] **Step 6: Commit**

```bash
git add src/lib/roles.ts src/lib/initials.ts src/lib/__tests__/lib.test.ts
git commit -m "feat(shell): add navTitleKey + initialsFrom helpers"
```

---

### Task 2: Topbar screen title + trim to LocaleToggle

**Files:**
- Create: `src/components/shell/ScreenTitle.tsx`
- Modify: `src/components/shell/Topbar.tsx`

**Interfaces:**
- Consumes: `navTitleKey` (Task 1).
- Produces: `<ScreenTitle />` — a client component rendering the localized current-screen title.
- Produces: updated `Topbar` that takes no props and no longer renders logout or the user block (both move to the Sidebar in Task 3). The layout call site (`<Topbar user={user} />` → `<Topbar />`) is updated in Task 3, Step 3, alongside the Sidebar change.

- [ ] **Step 1: Create `src/components/shell/ScreenTitle.tsx`**

```tsx
"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { navTitleKey } from "@/lib/roles";

// Localized title of the current screen, derived from the route. Client-only so
// the surrounding Topbar can stay a server component.
export function ScreenTitle() {
  const pathname = usePathname();
  const t = useTranslations();
  return (
    <div className="min-w-0 flex-1 truncate text-[17px] font-bold text-gray-900">
      {t(navTitleKey(pathname))}
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/components/shell/Topbar.tsx`**

Full new file contents:

```tsx
import { LocaleToggle } from "./LocaleToggle";
import { ScreenTitle } from "./ScreenTitle";

// App top bar: screen title on the left, language switch on the right. The
// signed-in user and logout now live in the Sidebar footer. Space to the right
// of LocaleToggle is intentionally reserved for a future notifications control.
export function Topbar() {
  return (
    <header className="sticky top-0 z-10 flex h-[58px] items-center gap-4 border-b border-[var(--color-line)] bg-white px-6">
      <ScreenTitle />
      <LocaleToggle />
    </header>
  );
}
```

Note: `Topbar` now takes no props. Its call site in `src/app/(app)/layout.tsx` is updated from `<Topbar user={user} />` to `<Topbar />` in Task 3, Step 3 (the same task that edits the layout for the Sidebar), so the build stays green there.

- [ ] **Step 3: Verify build + types**

Run: `npm run build`
Expected: PASS — compiles and type-checks clean; no unused-import errors (the removed `getTranslations`, `LogOut`, `signOut` imports are gone).

- [ ] **Step 4: Commit**

```bash
git add src/components/shell/ScreenTitle.tsx src/components/shell/Topbar.tsx
git commit -m "feat(shell): topbar shows screen title, drops logout/user block"
```

---

### Task 3: Sidebar brand + user footer, layout wiring, i18n subtitle

**Files:**
- Modify: `src/components/shell/Sidebar.tsx`
- Modify: `src/app/(app)/layout.tsx:` (change `<Sidebar role=... />` to `<Sidebar user=... />`)
- Modify: `messages/th.json`, `messages/en.json` (add `app.subtitle`)

**Interfaces:**
- Consumes: `initialsFrom` (Task 1), `CurrentUser` (`{ email, fullName, role }`), `signOut` server action from `@/lib/actions/auth`, `visibleNav`.
- Produces: `Sidebar({ user }: { user: CurrentUser })` — brand w/ icon + subtitle, role-gated nav (unchanged behavior), and a pinned user footer with initials avatar, name, role, and logout.

- [ ] **Step 1: Add the `app.subtitle` i18n key**

In `messages/th.json`, change the `app` object to:

```json
"app": { "name": "MatchPoint CRM", "subtitle": "RFID · Solution Sales" },
```

In `messages/en.json`, change the `app` object to:

```json
"app": { "name": "MatchPoint CRM", "subtitle": "RFID · Solution Sales" },
```

(Match each file's existing indentation and trailing-comma placement.)

- [ ] **Step 2: Replace `src/components/shell/Sidebar.tsx`**

Full new file contents:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Contact2,
  LayoutDashboard,
  Building2,
  Target,
  FolderKanban,
  FileText,
  CheckSquare,
  TrendingUp,
  Wallet,
  Receipt,
  PieChart,
  Users,
  Upload,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { visibleNav } from "@/lib/roles";
import { initialsFrom } from "@/lib/initials";
import { signOut } from "@/lib/actions/auth";
import type { CurrentUser } from "@/lib/auth";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Building2,
  Target,
  FolderKanban,
  FileText,
  CheckSquare,
  TrendingUp,
  Wallet,
  Receipt,
  PieChart,
  Users,
  Upload,
  Settings,
};

// Role-gated sidebar. Hidden groups are NOT rendered for Sales/Manager (UX);
// real enforcement is RLS + server checks.
export function Sidebar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const t = useTranslations();
  const groups = visibleNav(user.role);

  return (
    <nav
      className="flex h-full w-[248px] flex-col overflow-y-auto text-sm"
      style={{ background: "var(--color-sidebar)" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-[18px]">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[.65rem] bg-[var(--color-primary)] text-white">
          <Contact2 className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="truncate font-bold leading-tight text-white">
            {t("app.name")}
          </div>
          <div className="truncate text-[10.5px] text-gray-400">
            {t("app.subtitle")}
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-2">
        {groups.map((group) => (
          <div key={group.id} className="px-2">
            <div className="px-2 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {t(group.labelKey)}
            </div>
            {group.items.map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard;
              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`my-0.5 flex items-center gap-2.5 rounded-[.65rem] px-2.5 py-2 font-medium transition-colors ${
                    active
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* User footer */}
      <div className="flex items-center gap-2.5 border-t border-white/10 px-3.5 py-3">
        <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[13px] font-bold text-white">
          {initialsFrom(user.fullName, user.email)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-gray-200">
            {user.fullName ?? user.email}
          </div>
          <div className="text-[11px] text-gray-400">{t(`roles.${user.role}`)}</div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            title={t("common.signOut")}
            aria-label={t("common.signOut")}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[.5rem] text-gray-400 hover:bg-white/5 hover:text-gray-200"
          >
            <LogOut className="h-[17px] w-[17px]" aria-hidden />
          </button>
        </form>
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Update the layout call sites**

In `src/app/(app)/layout.tsx`, change:

```tsx
          <Sidebar role={user.role} />
```

to:

```tsx
          <Sidebar user={user} />
```

and change:

```tsx
        <Topbar user={user} />
```

to:

```tsx
        <Topbar />
```

(No other layout changes — `user` is already resolved above and still used for the `Sidebar` and the auth redirect.)

- [ ] **Step 4: Verify build + tests**

Run: `npm run build && npm test`
Expected: PASS — build compiles and type-checks clean; all 18 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/Sidebar.tsx "src/app/(app)/layout.tsx" messages/th.json messages/en.json
git commit -m "feat(shell): sidebar brand subtitle, icon logo, user footer with logout"
```

---

### Task 4: Shared primitives audit + manual QA + deploy

**Files:**
- Modify (only if a concrete mismatch is found): `src/components/ui/Card.tsx`, `src/components/ui/Button.tsx`, `src/components/ui/StageBadge.tsx`, `src/components/ui/GradeBadge.tsx`, and state components under `src/components/states/`.

**Interfaces:**
- Consumes: the completed shell from Tasks 2–3. No new exports.

- [ ] **Step 1: Audit primitives against the prototype**

Compare each primitive's radius / padding / shadow / border against the prototype
(`scratchpad/prototype.html`): cards use radius `.65rem`, soft shadow
`0 1px 3px rgba(0,0,0,.08)`, no border; pills `999px`; stage badges are
text-labelled (never color-only). Open each file and fix ONLY concrete
mismatches — do not restyle beyond the token values. If a primitive already
matches, leave it unchanged and note "no change" in the commit body.

- [ ] **Step 2: Verify build + tests still pass**

Run: `npm run build && npm test`
Expected: PASS — 18 tests, clean build.

- [ ] **Step 3: Manual QA (run the app)**

Run: `npm run dev`, open http://localhost:3000 (dev admin fallback applies with no Supabase env). Verify:
- Sidebar footer shows initials avatar + name + role; logout button is keyboard-focusable with a visible ring; clicking it signs out.
- Sidebar brand shows the `Contact2` icon + "MatchPoint CRM" + "RFID · Solution Sales".
- Top bar shows the correct screen title per route (`/dashboard`, `/customers`, `/customers/<id>`, `/settings/users`).
- Toggle TH / EN: all chrome (nav, subtitle, role, screen title) switches; Thai renders in Sarabun.
- Active nav item is highlighted; nested routes keep the parent highlighted.
- Nav item and logout hit areas are ~44px; focus rings visible on tab.

- [ ] **Step 4: Commit any primitive fixes**

```bash
git add src/components/ui src/components/states
git commit -m "style(ui): align primitives to prototype tokens"
```

(If Step 1 found no mismatches, skip this commit.)

- [ ] **Step 5: Deploy to production and smoke-check**

```bash
vercel --prod --yes
```

Then:

```bash
curl -s -o /dev/null -w "login: %{http_code}\n" https://crm-new-version.vercel.app/login
curl -s -o /dev/null -w "root:  %{http_code}\n" https://crm-new-version.vercel.app/
```

Expected: `login: 200`, `root: 307`. (Deploy is an outward-facing action — confirm with the user before running Step 5.)

---

## Self-Review

**Spec coverage:**
- Sidebar subtitle, icon logo, user footer, width 248, radius `.65rem` → Task 3. ✓
- Topbar screen title, remove logout/user, height 58 → Task 2. ✓
- `ScreenTitle` client sub-component, Topbar stays server → Task 2. ✓
- Shared primitives audit → Task 4. ✓
- i18n keys (subtitle; screen titles reuse `nav.*`) → Task 3 (subtitle), Task 2 (reuse). ✓
- Font strategy unchanged → Global Constraints. ✓
- Initials helper unit-tested → Task 1. ✓
- Non-goals (notifications, role switcher, DB) → Global Constraints. ✓
- Verify (build/test/manual/redeploy) → Tasks 3 & 4. ✓

**Placeholder scan:** No TBD/TODO; all code shown in full. ✓

**Type consistency:** `navTitleKey(pathname: string): string` and `initialsFrom(fullName, email): string` are defined in Task 1 and consumed with matching signatures in Tasks 2–3. `Sidebar` prop changes from `{ role }` to `{ user }`; the layout call site is updated in the same task (Task 3, Step 3). `Topbar` keeps `{ user }` so its call site is untouched. ✓
