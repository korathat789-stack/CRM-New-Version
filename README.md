# MatchPoint CRM (MPT-CRM)

Bilingual (Thai-first / English) sales CRM for an RFID / UHF / barcode hardware
team. Built with **Next.js (App Router) + TypeScript + Supabase**.

This repository is being built in phases against the Customer Page wireframes.
**Phase 1 (foundation) is complete** — scaffold, design system, i18n, Supabase
data layer, schema + RLS, auth, and the role-gated app shell. Feature pages
(Customers, Opportunities, Projects, Quotations, Reports, Settings) follow in
later phases.

## Tech stack

| Layer        | Choice                                              |
| ------------ | --------------------------------------------------- |
| Frontend     | Next.js 15 (App Router, RSC), React 19, TypeScript  |
| Styling      | Tailwind CSS v4 (design tokens in `globals.css`)    |
| i18n         | next-intl, Thai default (cookie-based locale)       |
| Fonts        | Sarabun (Thai-first) + Inter via `next/font`        |
| Icons        | lucide-react (no emoji)                             |
| Database/Auth| Supabase (Postgres, Auth, RLS, Storage)             |
| Data access  | `@supabase/ssr` (server/client/middleware clients)  |

## Design system (enforced)

Tokens live in `src/app/globals.css` (`@theme`). Do not hard-code hexes in
components.

- primary `#2563eb` · app bg `#f3f4f6` · sidebar `#111827` · text `#374151`
- card radius `0.65rem`, shadow `0 1px 3px rgba(0,0,0,.08)`, **no border**
- pills `999px`; locked stage colors (text-labelled, never color-only)
- money is **integer satang** (1 ฿ = 100 satang); display with ฿ + M/K short forms

## Domain logic (single sources of truth) — `src/lib/`

| File          | Responsibility                                              |
| ------------- | ----------------------------------------------------------- |
| `money.ts`    | satang ↔ baht, `formatBaht`, `formatBahtShort` (M/K)        |
| `grade.ts`    | A–F grade bands + `computeGrade` (Annual / Lifetime basis)  |
| `margin.ts`   | margin %, ÷0 guard (value 0 → "—"), color thresholds        |
| `stages.ts`   | locked pipeline stages, order, colors, labels               |
| `roles.ts`    | Admin / Manager / Sales model + nav gating helpers          |
| `auth.ts`     | `getCurrentUser`, `requireRole` (server-side checks)        |

## Roles

| Capability                 | Admin | Manager | Sales |
| -------------------------- | :---: | :-----: | :---: |
| View & edit records        |  ✓    |   ✓     |  ✓    |
| Delete records             |  ✓    |   ✓     |  ✗    |
| Authorize / sign-off (Won) |  ✓    |   ✓     |  ✗    |
| View Reports               |  ✓    |   ✓     |  ✗    |
| Settings / config          |  ✓    |   ✗     |  ✗    |
| Manage users & permissions |  ✓    |   ✗     |  ✗    |

Permissions are enforced in **two layers**: Supabase RLS (source of truth) and
server-side checks in Server Actions. Hidden menus are UX only.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the migrations in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_mpt_crm_core.sql` ← full MatchPoint schema + RLS
3. Enable **Email** auth (and Google if desired) under Authentication → Providers.
4. The **first** user to sign up becomes `admin` automatically; everyone else
   starts as `sales` (change roles later in Users & Roles).
5. Copy **Project URL** and **anon public** key from Settings → API.

> `0002` drops the demo `customers` table from `0001` and rebuilds the real
> model (customers, contacts, opportunities, projects, quotations,
> quotation_items, invoices, profiles, activities, audit_log + config tables),
> with code generators (`CUS-000001`, `OPP-000001`, `PRJ-1001`, `Q…`),
> soft-delete, and RLS policies.

### 2. Run locally

```bash
cp .env.example .env.local   # fill in Supabase URL + anon key
npm install
npm run dev                  # http://localhost:3000
```

Without Supabase env vars the app still runs (auth is bypassed and a local
"admin" is used) so the shell is explorable. **Configure Supabase for real
auth and data.**

### Environment variables

| Name                            | Description                          |
| ------------------------------- | ------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key             |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only; admin tasks. Never public |

## How to test Phase 1

1. `npm run build` — compiles and type-checks clean.
2. `npm run dev`, open `/` → redirects to `/dashboard` (app shell renders).
3. Toggle **TH / EN** in the top bar — all chrome strings switch; Thai renders
   in Sarabun.
4. Sidebar shows role-gated groups (Main / Reports / Admin). With the dev admin
   fallback you see all three.
5. With Supabase configured: visiting any app route while signed out redirects
   to `/login`; signing in returns you to the app.

> The legacy generic `/customers` pages from the original commit are superseded
> and will be rebuilt against the MatchPoint schema in Phase 2.

## Project structure

```
src/
  app/
    (app)/              # authenticated shell (sidebar + topbar)
      layout.tsx
      dashboard/page.tsx
      loading.tsx
    login/page.tsx
    layout.tsx          # fonts + i18n provider
    error.tsx, not-found.tsx, globals.css
  components/
    ui/                 # Card, Button, StageBadge, GradeBadge
    shell/              # Sidebar, Topbar, LocaleToggle
    states/             # Empty / Error / NoAccess / Skeleton
  lib/
    supabase/           # server, client, middleware, admin
    actions/            # auth, locale (server actions)
    money/grade/margin/stages/roles/auth
  i18n/                 # next-intl config + request
messages/               # th.json, en.json
supabase/migrations/    # 0001_init.sql, 0002_mpt_crm_core.sql
middleware.ts           # session refresh + route protection
```
