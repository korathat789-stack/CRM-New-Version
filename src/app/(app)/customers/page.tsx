import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { GradeBadge } from "@/components/ui/GradeBadge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/states/StateViews";
import { CustomerSearch } from "@/components/customers/CustomerSearch";
import { GradeBasisToggle } from "@/components/customers/GradeBasisToggle";
import { listCustomers, type CustomerListItem } from "@/lib/customers";
import { isSupabaseConfigured } from "@/lib/config";
import { type Grade, type GradeBasis } from "@/lib/grade";
import { formatBahtShort } from "@/lib/money";

type SP = {
  q?: string;
  grade?: string;
  basis?: string;
  sel?: string;
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const t = await getTranslations("customers");
  const locale = await getLocale();
  const basis: GradeBasis = sp.basis === "lifetime" ? "lifetime" : "annual";
  const grade = (["A", "B", "C", "D", "F"] as Grade[]).includes(sp.grade as Grade)
    ? (sp.grade as Grade)
    : null;

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-6xl">
        <Header t={t} basis={basis} />
        <div className="mt-4">
          <EmptyState />
        </div>
      </div>
    );
  }

  // One round-trip for the list (incl. open-pipeline rollup). The right-hand
  // preview reuses a row from this list — no extra per-selection query.
  const customers = await listCustomers({ q: sp.q, grade: grade ?? undefined, basis });
  const selected = sp.sel ? customers.find((c) => c.id === sp.sel) ?? null : null;

  const buildHref = (sel: string) => {
    const next = new URLSearchParams();
    if (sp.q) next.set("q", sp.q);
    if (grade) next.set("grade", grade);
    next.set("basis", basis);
    next.set("sel", sel);
    return `/customers?${next.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl">
      <Header t={t} basis={basis} count={customers.length} />

      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        {/* Left: search + list */}
        <Card className="flex w-full flex-col overflow-hidden lg:w-[380px]">
          <div className="border-b border-[var(--color-line)] p-3">
            <CustomerSearch q={sp.q ?? ""} grade={grade} />
          </div>
          <div className="flex-1 overflow-y-auto">
            {customers.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                {t("noCustomers")}
              </div>
            ) : (
              customers.map((c) => {
                const active = sp.sel === c.id;
                return (
                  <Link
                    key={c.id}
                    href={buildHref(c.id)}
                    scroll={false}
                    className={`flex items-center gap-2.5 border-b border-[var(--color-line-soft)] px-3 py-2.5 text-sm ${
                      active
                        ? "border-l-[3px] border-l-[var(--color-primary)] bg-blue-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <GradeBadge grade={c.grade} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-gray-900">
                        {c.name}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {c.code} ·{" "}
                        {c.open_pipeline > 0
                          ? `${formatBahtShort(c.open_pipeline)} ${t("open")}`
                          : t("noOpenValue")}
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </Card>

        {/* Right: detail preview (reuses the selected list row) */}
        <div className="hidden flex-1 lg:block">
          {selected ? (
            <Preview customer={selected} t={t} locale={locale} />
          ) : (
            <Card>
              <CardBody className="flex min-h-[300px] items-center justify-center text-sm text-gray-400">
                {t("selectHint")}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({
  t,
  basis,
  count,
}: {
  t: Awaited<ReturnType<typeof getTranslations>>;
  basis: GradeBasis;
  count?: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex-1">
        <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
        {count !== undefined && (
          <p className="text-sm text-gray-500">{t("subtitle", { count })}</p>
        )}
      </div>
      <GradeBasisToggle basis={basis} />
      <Link href="/customers/new">
        <Button>
          <Plus className="h-4 w-4" aria-hidden />
          {t("newCustomer")}
        </Button>
      </Link>
    </div>
  );
}

function Preview({
  customer,
  t,
  locale,
}: {
  customer: CustomerListItem;
  t: Awaited<ReturnType<typeof getTranslations>>;
  locale: string;
}) {
  const typeLabel =
    locale === "th" ? customer.type_label_th : customer.type_label_en;

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <GradeBadge grade={customer.grade} size="md" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold text-gray-900">{customer.name}</div>
            <div className="truncate text-xs text-gray-500">
              {customer.code}
              {typeLabel ? ` · ${typeLabel}` : ""}
            </div>
          </div>
          <Link href={`/customers/${customer.id}`}>
            <Button variant="outline">{t("openFull")} ↗</Button>
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <Stat label={t("insight.lifetimeRevenue")} value={formatBahtShort(customer.lifetime_revenue)} />
          <Stat label={t("insight.openPipeline")} value={formatBahtShort(customer.open_pipeline)} />
          <Stat label={t("details.owner")} value={customer.owner_name ?? "—"} />
        </div>
      </CardBody>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-dashed border-gray-300 p-2.5">
      <div className="text-[10px] uppercase text-gray-500">{label}</div>
      <div className="truncate text-base font-bold text-gray-900">{value}</div>
    </div>
  );
}
