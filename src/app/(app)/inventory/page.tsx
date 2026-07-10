import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus, Pencil } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/states/StateViews";
import { InventoryFilters } from "@/components/inventory/InventoryFilters";
import { StockAdjuster } from "@/components/inventory/StockAdjuster";
import {
  listProducts,
  stockStatus,
  stockValue,
  STOCK_STATUS_COLORS,
  type ProductRow,
} from "@/lib/inventory";
import { getCurrentUser } from "@/lib/auth";
import { canManageInventory } from "@/lib/roles";
import { isSupabaseConfigured } from "@/lib/config";
import { formatBahtShort } from "@/lib/money";

const GRID = "grid grid-cols-[2fr_1fr_0.8fr_0.9fr_1fr_0.9fr] gap-2 items-center";

type SP = { q?: string; category?: string; status?: string };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const t = await getTranslations("inventory");
  const user = await getCurrentUser();
  const canManage = !!user && canManageInventory(user.role);

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

  const { rows, summary } = await listProducts({
    q: sp.q,
    category: sp.category,
    status: sp.status,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">
            {t("subtitle", { count: summary.skuCount })}
          </p>
        </div>
        {canManage && (
          <Link href="/inventory/new">
            <Button>
              <Plus className="h-4 w-4" aria-hidden />
              {t("newProduct")}
            </Button>
          </Link>
        )}
      </div>

      {/* Summary cards */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label={t("summary.skus")} value={String(summary.skuCount)} />
        <SummaryCard label={t("summary.lowOut")} value={String(summary.lowOutCount)} />
        <SummaryCard label={t("summary.stockValue")} value={formatBahtShort(summary.stockValue)} />
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-[var(--color-line)] bg-gray-50 p-3">
          <InventoryFilters
            q={sp.q ?? ""}
            category={sp.category ?? "all"}
            status={sp.status ?? "all"}
          />
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">{t("noProducts")}</div>
        ) : (
          <div className="hidden md:block">
            <div className={`${GRID} border-b border-[var(--color-line)] bg-gray-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-gray-500`}>
              <div>{t("cols.name")}</div>
              <div>{t("cols.category")}</div>
              <div className="text-right">{t("cols.qty")}</div>
              <div>{t("cols.status")}</div>
              <div className="text-right">{t("cols.value")}</div>
              <div />
            </div>
            {rows.map((p) => (
              <Row key={p.id} p={p} canManage={canManage} t={t} />
            ))}
          </div>
        )}

        {/* Mobile cards */}
        {rows.length > 0 && (
          <div className="md:hidden">
            {rows.map((p) => (
              <MobileRow key={p.id} p={p} canManage={canManage} t={t} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold text-gray-900">{value}</div>
    </Card>
  );
}

function StatusBadge({ status, label }: { status: "in_stock" | "low" | "out"; label: string }) {
  const c = STOCK_STATUS_COLORS[status];
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: c.bg, color: c.fg }}
    >
      {label}
    </span>
  );
}

function Row({
  p,
  canManage,
  t,
}: {
  p: ProductRow;
  canManage: boolean;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const status = stockStatus(p.qty_on_hand, p.safety_stock);
  return (
    <div className={`${GRID} border-b border-[var(--color-line-soft)] px-4 py-2.5 text-xs`}>
      <div>
        <div className="font-semibold text-gray-900">{p.name}</div>
        <div className="text-[10px] text-gray-400">{p.code}</div>
      </div>
      <div className="text-gray-700">{t(`category.${p.category}`)}</div>
      <div className="text-right font-bold text-gray-900">
        {p.qty_on_hand} {p.unit}
      </div>
      <div>
        <StatusBadge status={status} label={t(`status.${status}`)} />
      </div>
      <div className="text-right text-gray-700">
        {formatBahtShort(stockValue(p.qty_on_hand, p.cost))}
      </div>
      <div className="flex items-center justify-end gap-2">
        {canManage && <StockAdjuster productId={p.id} productName={p.name} />}
        {canManage && (
          <Link href={`/inventory/${p.id}/edit`} className="text-gray-400 hover:text-[var(--color-primary)]" aria-label={t("editProduct")}>
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}

function MobileRow({
  p,
  canManage,
  t,
}: {
  p: ProductRow;
  canManage: boolean;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const status = stockStatus(p.qty_on_hand, p.safety_stock);
  return (
    <div className="flex flex-col gap-2 border-b border-[var(--color-line-soft)] p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-gray-900">{p.name}</div>
          <div className="text-[10px] text-gray-400">{p.code}</div>
        </div>
        <StatusBadge status={status} label={t(`status.${status}`)} />
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">{t("cols.qty")}</span>
        <b>{p.qty_on_hand} {p.unit}</b>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">{t("cols.value")}</span>
        <b>{formatBahtShort(stockValue(p.qty_on_hand, p.cost))}</b>
      </div>
      {canManage && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <StockAdjuster productId={p.id} productName={p.name} />
          <Link href={`/inventory/${p.id}/edit`} className="rounded-md border border-[var(--color-line)] px-2 py-1 font-semibold text-gray-600">
            {t("editProduct")}
          </Link>
        </div>
      )}
    </div>
  );
}
