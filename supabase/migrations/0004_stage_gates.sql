-- ============================================================================
-- MatchPoint CRM — sales workflow stage gates
-- Adds the opportunity fields the stage-gate engine reads (POC, sign-off,
-- signed quotation). Run AFTER 0002/0003. Gate RULES live in app code
-- (lib/gates.ts) shared by the completeness tracker and the gate modal.
-- ============================================================================

alter table public.opportunities
  add column if not exists poc_scheduled_at date,
  add column if not exists poc_result       text,
  add column if not exists signed_quote_url text,
  add column if not exists authorized_by    uuid references public.profiles (id),
  add column if not exists authorized_at    timestamptz;
