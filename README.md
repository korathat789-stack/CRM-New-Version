# CRM — Customer Page

A customer management page built from the **Customer Page Wireframes**, using
**Next.js (App Router)** for the front end and **Supabase** (Postgres) for the
database. Designed to deploy to **Vercel**.

> Note: the original Claude Design wireframe could not be pulled into this web
> session (it requires interactive `/design-login`). This is a conventional
> CRM customer page built to standard wireframe conventions — refine the layout
> against the wireframe as needed.

## Features

- **Customer list** with search (name / company / email) and status filters
  (active · lead · inactive)
- **Customer detail / profile** view with contact, location and notes
- **Create / edit / delete** customers via Next.js Server Actions
- Server-rendered with Supabase row-level security
- Tailwind CSS v4 styling

## Tech stack

| Layer    | Choice                                   |
| -------- | ---------------------------------------- |
| Frontend | Next.js 15 (App Router), React 19, TS    |
| Styling  | Tailwind CSS v4                          |
| Database | Supabase (Postgres)                      |
| Client   | `@supabase/ssr`, `@supabase/supabase-js` |
| Hosting  | Vercel                                   |

## Project structure

```
src/
  app/
    customers/
      page.tsx              # list + search + filters
      actions.ts            # create / update / delete (server actions)
      new/page.tsx          # create form
      [id]/page.tsx         # detail / profile
      [id]/edit/page.tsx    # edit form
    layout.tsx, page.tsx
  components/               # CustomerForm, SearchBar, StatusBadge, DeleteButton
  lib/
    supabase/server.ts      # server-side Supabase client
    types.ts                # Customer types
supabase/
  migrations/0001_init.sql  # schema + RLS
  seed.sql                  # optional sample data
```

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the contents of `supabase/migrations/0001_init.sql`.
3. (Optional) run `supabase/seed.sql` for sample customers.
4. In **Project Settings → API**, copy the **Project URL** and **anon public**
   key.

> The demo RLS policies allow anonymous read/write so the page works without
> auth. **Tighten these policies before production** (e.g. require
> `auth.role() = 'authenticated'`).

## 2. Run locally

```bash
cp .env.example .env.local   # then fill in your Supabase URL + anon key
npm install
npm run dev                  # http://localhost:3000
```

## 3. Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project** and import the repo (framework auto-detects
   as Next.js).
3. Add environment variables (Project → Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Deploy.**

## Environment variables

| Name                            | Description                       |
| ------------------------------- | --------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public API key      |
