import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TrendingUp, Wallet, FileText, PieChart, Bell, CheckSquare } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { StageBarChart } from "@/components/reports/charts";
import { StageBadge } from "@/components/ui/StageBadge";
import { PeriodToggle } from "@/components/dashboard/PeriodToggle";
import { getDashboard, type Period } from "@/lib/dashboard";
import { isSupabaseConfigured } from "@/lib/config";
import { STAGES } from "@/lib/stages";
import { formatBahtShort } from "@/lib/money";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period: Period = (["month", "quarter", "year"].includes(periodParam ?? "")
    ? periodParam
    : "quarter") as Period;
  const t = await getTranslations("dashboard");
  const ts = await getTranslations();

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
        <Card className="mt-4 p-8 text-center text-sm text-gray-500">—</Card>
      </div>
    );
  }

  const d = await getDashboard(period);
  const funnelData = d.funnel.map((f) => ({
    name: ts(STAGES[f.stage].labelKey),
    value: f.value,
    color: STAGES[f.stage].fg,
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <PeriodToggle period={period} />
      </div>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={FileText} label={t("kpi.quotationTotal")} value={formatBahtShort(d.quotationTotal)} />
        <Kpi icon={TrendingUp} label={t("kpi.wonTotal")} value={formatBahtShort(d.wonTotal)} tone="#16a34a" />
        <Kpi icon={Wallet} label={t("kpi.openPipeline")} value={formatBahtShort(d.openPipeline)} tone="#d97706" />
        <Kpi icon={PieChart} label={t("kpi.profit")} value={formatBahtShort(d.profit)} tone="#16a34a" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* Funnel / bottleneck */}
        <Card>
          <CardBody>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">{t("funnel")}</span>
              {d.bottleneck && (
                <span className="pill bg-[#fef3c7] px-2.5 py-0.5 text-[11px] font-medium text-[#b45309]">
                  {t("bottleneck", { stage: ts(STAGES[d.bottleneck].labelKey) })}
                </span>
              )}
            </div>
            <StageBarChart data={funnelData} />
            <div className="mt-2 grid grid-cols-5 gap-1 text-center">
              {d.funnel.map((f) => (
                <div key={f.stage} className="flex flex-col items-center gap-1">
                  <StageBadge code={f.stage} />
                  <span className="text-[11px] text-gray-500">{t("count", { count: f.count })}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Notifications */}
        <Card>
          <CardBody>
            <div className="mb-2 flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-500" aria-hidden />
              <span className="text-sm font-bold text-gray-900">{t("notifications")}</span>
            </div>
            {d.pendingApproval === 0 && d.overdueTasks === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">{t("allClear")}</div>
            ) : (
              <div className="flex flex-col gap-2">
                {d.pendingApproval > 0 && (
                  <Link
                    href="/opportunities"
                    className="flex items-center gap-2 rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs text-[#92400e]"
                  >
                    <CheckSquare className="h-3.5 w-3.5" aria-hidden />
                    {t("pendingApproval", { count: d.pendingApproval })}
                  </Link>
                )}
                {d.overdueTasks > 0 && (
                  <Link
                    href="/tasks"
                    className="flex items-center gap-2 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]"
                  >
                    <CheckSquare className="h-3.5 w-3.5" aria-hidden />
                    {t("overdueTasks", { count: d.overdueTasks })}
                  </Link>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-gray-100 text-gray-500">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
          <div className="text-lg font-bold" style={{ color: tone ?? "var(--color-ink)" }}>
            {value}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
