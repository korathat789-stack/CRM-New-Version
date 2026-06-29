-- ============================================================================
-- MatchPoint CRM — reports support
-- Adds the overall sales target to config and convenience aggregation views.
-- Run AFTER 0002_mpt_crm_core.sql. Report aggregation is done in the app
-- (lib/reports.ts) reading base tables; these views are provided as documented
-- SQL helpers and use security_invoker so underlying RLS still applies.
-- ============================================================================

alter table public.app_config
  add column if not exists sales_target bigint not null default 500000000; -- ฿5M

-- Open pipeline value by stage.
create or replace view public.report_pipeline_by_stage
  with (security_invoker = true) as
  select stage,
         coalesce(sum(value), 0)::bigint as value,
         count(*)::int as count
  from public.opportunities
  where deleted_at is null
    and stage in ('inquiry','presentation','quotation','poc','negotiation')
  group by stage;

-- Won value by owner.
create or replace view public.report_sales_by_owner
  with (security_invoker = true) as
  select o.owner_id,
         coalesce(p.full_name, 'Unassigned') as owner_name,
         coalesce(sum(o.value) filter (where o.stage = 'won'), 0)::bigint as won
  from public.opportunities o
  left join public.profiles p on p.id = o.owner_id
  where o.deleted_at is null
  group by o.owner_id, p.full_name;

-- Per-project value / cost / budget (Cost Budgeting + P&L source).
create or replace view public.report_project_costs
  with (security_invoker = true) as
  select id, name, stage, value, cost, budget, due_date
  from public.projects
  where deleted_at is null;
