import { createClient } from "./supabase/server";
import { OPEN_STAGES, type StageCode } from "./stages";

export type Period = "month" | "quarter" | "year";

const OPEN_SET = new Set<StageCode>(OPEN_STAGES);

export interface FunnelStage {
  stage: StageCode;
  count: number;
  value: number;
}

export interface DashboardData {
  quotationTotal: number;
  wonTotal: number;
  openPipeline: number;
  profit: number;
  funnel: FunnelStage[];
  bottleneck: StageCode | null;
  pendingApproval: number;
  overdueTasks: number;
  followupsDue: number;
}

function periodBounds(period: Period, now: Date): { start: string; end: string } {
  const y = now.getUTCFullYear();
  if (period === "year") {
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
  if (period === "quarter") {
    const q = Math.floor(now.getUTCMonth() / 3);
    const start = new Date(Date.UTC(y, q * 3, 1));
    const end = new Date(Date.UTC(y, q * 3 + 3, 0));
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export async function getDashboard(
  period: Period,
  now: Date = new Date()
): Promise<DashboardData> {
  const supabase = await createClient();
  const { start, end } = periodBounds(period, now);
  const today = now.toISOString().slice(0, 10);

  const [oppsRes, quotesRes, projectsRes, pendingRes, overdueRes, followupRes] = await Promise.all([
    supabase.from("opportunities").select("stage, value").is("deleted_at", null),
    supabase.from("quotations").select("total").is("deleted_at", null),
    supabase
      .from("projects")
      .select("value, cost, due_date, stage")
      .is("deleted_at", null)
      .eq("stage", "won"),
    supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("stage", "negotiation")
      .is("authorized_by", null),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "open")
      .lt("due_date", today),
    supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .in("stage", OPEN_STAGES)
      .lte("next_action_date", today),
  ]);

  const opps = (oppsRes.data ?? []) as { stage: StageCode; value: number }[];
  let wonTotal = 0;
  let openPipeline = 0;
  const stageMap = new Map<StageCode, { count: number; value: number }>();
  for (const s of OPEN_STAGES) stageMap.set(s, { count: 0, value: 0 });
  for (const o of opps) {
    if (OPEN_SET.has(o.stage)) {
      openPipeline += o.value;
      const cur = stageMap.get(o.stage)!;
      cur.count += 1;
      cur.value += o.value;
    } else if (o.stage === "won") {
      wonTotal += o.value;
    }
  }

  const funnel: FunnelStage[] = OPEN_STAGES.map((stage) => ({
    stage,
    count: stageMap.get(stage)!.count,
    value: stageMap.get(stage)!.value,
  }));
  // Bottleneck = open stage holding the most value.
  const bottleneck =
    funnel.reduce<FunnelStage | null>((max, f) => (!max || f.value > max.value ? f : max), null)
      ?.value
      ? funnel.reduce((max, f) => (f.value > max.value ? f : max)).stage
      : null;

  const quotationTotal = (quotesRes.data ?? []).reduce(
    (s, q) => s + (q.total as number),
    0
  );

  // Profit (gross) for the selected period from won projects in the window.
  let profit = 0;
  for (const p of projectsRes.data ?? []) {
    const d = p.due_date as string | null;
    if (d && d >= start && d <= end) {
      profit += (p.value as number) - (p.cost as number);
    }
  }

  return {
    quotationTotal,
    wonTotal,
    openPipeline,
    profit,
    funnel,
    bottleneck,
    pendingApproval: pendingRes.count ?? 0,
    overdueTasks: overdueRes.count ?? 0,
    followupsDue: followupRes.count ?? 0,
  };
}
