# Design System / Shell Alignment — Design Spec

**Date:** 2026-07-05
**Sub-project:** A (first of A–E) in the "align live app to MatchPoint CRM Prototype" effort
**Status:** Approved design → pending implementation plan

## Context

The deployed MatchPoint CRM (Next.js, Phases 1–8, live at
https://crm-new-version.vercel.app) looks "older" than the approved Claude design
prototype (`MatchPoint CRM Prototype.dc.html`). The prototype spans ~17 screens +
14 modals, including new modules (Inventory, Tasks, Opportunities Kanban) not yet
built.

That full effort was decomposed into sub-projects A–E. **This spec covers only
sub-project A: Design System / Shell Alignment** — the shared shell and UI
primitives every page depends on. It is the foundation the later sub-projects
build on.

Good news from the gap analysis: the app and prototype already share the same
design tokens (primary `#2563eb`, app bg `#f3f4f6`, sidebar `#111827`, radius
`.65rem`) and the sidebar already uses grouped nav + lucide icons. The "old" feel
comes from missing shell details, not a wrong foundation.

## Goals

Bring the app shell and shared UI primitives in line with the prototype's visual
language, without touching data, business logic, or per-page content.

## Non-goals (explicitly out of scope for A)

- Notifications bell/feed — deferred to its own sub-project (needs a data model;
  an empty placeholder button would violate the "no placeholder" rule).
- Role switcher ("View as") — a prototype-only demo affordance. Real roles come
  from auth; a live role-swap control is a security risk unless implemented as
  audited admin impersonation, which is a separate concern.
- Per-page redesigns (Customer 360 tabs/variants, Dashboard charts, etc.).
- New modules: Inventory (E), Tasks (D), Opportunities Kanban (C), modals (B).
- Any Supabase schema / migration / RLS change.

## Font decision

Keep the current **Sarabun (Thai) + Inter (Latin/numerals)** strategy. The
prototype is an English-only mock rendered in Inter; the live app is Thai-first
and Sarabun reads better for Thai users. No font change.

## Design

### 1. Sidebar — `src/components/shell/Sidebar.tsx`

Current state: grouped role-gated nav, lucide icons, active state (primary bg),
"M" text logo, width `w-60` (240px). Changes:

- **Brand:** add subtitle "RFID · Solution Sales" under the app name; replace the
  "M" text badge with the lucide `Contact2` icon (matches prototype).
- **User footer** (new): a bottom section pinned below the nav showing a circular
  avatar with the user's initials, full name (truncated), role label, and a
  logout button. The logout action moves here from the Topbar.
  - The component now receives `user: CurrentUser` as a prop.
- **Dimensions:** width 240 → 248px; nav-item corner radius → `.65rem` (token),
  matching prototype (currently `rounded-md`).
- Keep existing role-gating (`visibleNav(role)`), i18n labels, and active-route
  logic unchanged.

Initials helper: derive from `fullName` (first letters of up to two words) with a
fallback to the first character of the email. Small pure helper, unit-testable.

### 2. Topbar — `src/components/shell/Topbar.tsx`

Current state: spacer, LocaleToggle, user name/role, logout button, height 56px.
Changes:

- Add a **screen title** on the left, derived from the current pathname mapped to
  an i18n key (e.g. `/dashboard` → nav.dashboard). Height 56 → 58px.
- Remove the logout button and the user name/role block (both now live in the
  sidebar footer).
- Keep LocaleToggle on the right; leave horizontal space reserved where the
  notifications bell will later go (no placeholder element rendered).
- The pathname→title map lives in a small shared module so Sidebar/Topbar/nav
  config stay a single source of truth (reuse the existing nav config in
  `src/lib/roles.ts` rather than duplicating labels).

### 3. Shared UI primitives — `src/components/ui/`

Audit `Card`, `Button`, `StageBadge`, `GradeBadge`, table row styles, form
inputs, and the state components (Empty / Error / NoAccess / Skeleton) against the
prototype. Fix only concrete mismatches in spacing / radius / shadow / border.
Expected to be minor because tokens already match. No API changes to these
components.

### 4. i18n — `messages/th.json`, `messages/en.json`

Add the new keys required: brand subtitle and any screen-title keys not already
present (reuse existing `nav.*` labels where possible). No hard-coded UI strings.

## Data flow

The `(app)` layout already resolves `CurrentUser` server-side and renders
`<Sidebar>` + `<Topbar>`. The layout passes `user` into `<Sidebar>` (new) and
stops passing logout responsibilities to `<Topbar>`.

`Topbar` stays a **server** component (it uses `getTranslations`). The screen
title is rendered by a small **client** sub-component `ScreenTitle`
(`src/components/shell/ScreenTitle.tsx`) that reads `usePathname()`, maps the path
to a nav key via the shared nav config, and displays the localized label. This
isolates the only client-side concern and keeps `Topbar` server-rendered.
`Sidebar` is already a client component (`usePathname` for active state), so the
new user footer and logout `form action={signOut}` fit there without a boundary
change.

## Testing & verification

- `npm test` — add a unit test for the initials helper; existing 13 tests stay
  green.
- `npm run build` — type-check + production build clean.
- Manual QA: sidebar user footer renders correct name/role/initials; logout works
  from the sidebar; screen title updates per route; TH/EN toggle switches all
  chrome incl. new strings; Thai renders in Sarabun; responsive (sidebar behavior
  on mobile) and visible focus rings preserved; 44px touch targets on the logout
  and nav controls.
- Redeploy production (`vercel --prod`) after verification, then a smoke check of
  `/login` (200) and `/` (307).

## Risks / rollback

Low risk: presentational shell changes only. Rollback = revert the branch /
redeploy the previous production deployment. No data or schema touched.
