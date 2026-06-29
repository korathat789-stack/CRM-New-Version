import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StageBadge } from "@/components/ui/StageBadge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/states/StateViews";
import { ProjectFilters } from "@/components/projects/ProjectFilters";
import {
  listProjects,
  listProjectOwners,
  type ProjectRow,
  type DueFilter,
  type ProjectSort,
} from "@/lib/projects";
import { parseStageFilter } from "@/lib/stages";
import { isSupabaseConfigured } from "@/lib/config";
import { formatBahtShort } from "@/lib/money";
import {
  marginTone,
  marginToneColor,
  formatMarginPct,
} from "@/lib/margin";

const GRID =
  "grid grid-cols-[2.2fr_1.4fr_1fr_0.9fr_0.9fr_1fr_1.1fr_0.4fr] gap-2 items-center";

const VALUE_MIN: Record<string, number> = {
  "1m": 100000000,
  "5m": 500000000,
};

type SP = {
  q?: string;
  status?: string;
  owner?: string;
  value?: string;
  due?: string;
  sort?: string;
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const t = await getTranslations("projects");

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

  const [{ rows, totals }, owners] = await Promise.all([
    listProjects({
      q: sp.q,
      stage: parseStageFilter(sp.status),
      ownerId: sp.owner || undefined,
      valueMin: sp.value ? VALUE_MIN[sp.value] : undefined,
      due: (["overdue", "quarter"].includes(sp.due ?? "") ? sp.due : "all") as DueFilter,
      sort: (["value", "margin", "due"].includes(sp.sort ?? "")
        ? sp.sort
        : "value") as ProjectSort,
    }),
    listProjectOwners(),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">
            {t("subtitle", { count: totals.count })}
          </p>
        </div>
        <Button disabled title="">
          <Plus className="h-4 w-4" aria-hidden />
          {t("newProject")}
        </Button>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-[var(--color-line)] bg-gray-50 p-3">
          <ProjectFilters
            q={sp.q ?? ""}
            status={sp.status ?? "all"}
            owner={sp.owner ?? "all"}
            value={sp.value ?? "all"}
            due={sp.due ?? "all"}
            sort={sp.sort ?? "value"}
            owners={owners}
          />
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            {t("noProjects")}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <div
                className={`${GRID} border-b border-[var(--color-line)] bg-gray-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-gray-500`}
              >
                <div>{t("cols.project")}</div>
                <div>{t("cols.customer")}</div>
                <div className="text-right">{t("cols.value")}</div>
                <div>{t("cols.due")}</div>
                <div>{t("cols.estDate")}</div>
                <div className="text-right">{t("cols.cost")}</div>
                <div className="text-right">{t("cols.margin")}</div>
                <div />
              </div>
              {rows.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className={`${GRID} border-b border-[var(--color-line-soft)] px-4 py-2.5 text-xs hover:bg-gray-50`}
                >
                  <div>
                    <div className="font-semibold text-gray-900">{p.name}</div>
                    <StageBadge code={p.stage} />
                  </div>
                  <div className="text-gray-700">{p.customer_name ?? "—"}</div>
                  <div className="text-right font-bold text-gray-900">
                    {formatBahtShort(p.value)}
                  </div>
                  <div className="text-gray-700">{shortDate(p.due_date)}</div>
                  <div className="text-gray-500">{shortDate(p.est_date)}</div>
                  <div className="text-right text-gray-700">
                    {formatBahtShort(p.cost)}
                  </div>
                  <MarginCell p={p} />
                  <div className="text-right text-[var(--color-primary)]">
                    <ArrowUpRight className="ml-auto h-3.5 w-3.5" aria-hidden />
                  </div>
                </Link>
              ))}
              {/* Totals */}
              <div
                className={`${GRID} bg-gray-50 px-4 py-3 text-xs font-bold text-gray-900`}
              >
                <div className="text-[10px] uppercase tracking-wide text-gray-500">
                  {t("total", { count: totals.count })}
                </div>
                <div />
                <div className="text-right">{formatBahtShort(totals.value)}</div>
                <div />
                <div />
                <div className="text-right">{formatBahtShort(totals.cost)}</div>
                <div className="text-right">
                  {formatMarginPct(totals.margin_pct)}{" "}
                  <span className="font-normal text-gray-400">{t("blended")}</span>
                </div>
                <div />
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden">
              {rows.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex flex-col gap-2 border-b border-[var(--color-line-soft)] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-gray-900">{p.name}</div>
                    <StageBadge code={p.stage} />
                  </div>
                  <div className="text-xs text-gray-500">{p.customer_name}</div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">{t("cols.value")}</span>
                    <b>{formatBahtShort(p.value)}</b>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">{t("cols.margin")}</span>
                    <b style={{ color: marginToneColor(marginTone(p.margin_pct)) }}>
                      {formatMarginPct(p.margin_pct)}
                    </b>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function MarginCell({ p }: { p: ProjectRow }) {
  const color = marginToneColor(marginTone(p.margin_pct));
  return (
    <div className="text-right">
      <b style={{ color }}>{formatMarginPct(p.margin_pct)}</b>
      <div className="text-[10px] text-gray-400">
        {formatBahtShort(p.margin_amount)}
      </div>
    </div>
  );
}

function shortDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}
