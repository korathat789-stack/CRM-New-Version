import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/states/StateViews";
import { getCurrentUser } from "@/lib/auth";
import { canManageInventory } from "@/lib/roles";
import { isSupabaseConfigured } from "@/lib/config";
import { listGoodsReceipts } from "@/lib/goodsReceipts";
import { ReceiptFilters } from "@/components/goods-receipts/ReceiptFilters";
import { ReceiptStatusBadge } from "@/components/goods-receipts/ReceiptStatusBadge";

const GRID =
  "grid grid-cols-[0.9fr_0.9fr_2fr_1.3fr_1fr_0.8fr_0.9fr] gap-2 items-center";

type SP = { status?: string };

export default async function GoodsReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user.role)) redirect("/inventory");
  const sp = await searchParams;
  const t = await getTranslations("goodsReceipts");

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
        <div className="mt-4">
          <EmptyState body={t("none")} />
        </div>
      </div>
    );
  }

  const rows = await listGoodsReceipts({ status: sp.status });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">
            {t("subtitle", { count: rows.length })}
          </p>
        </div>
        <Link href="/goods-receipts/new">
          <Button variant="success">
            <Plus className="h-4 w-4" aria-hidden />
            {t("new")}
          </Button>
        </Link>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-[var(--color-line)] bg-gray-50 p-3">
          <ReceiptFilters status={sp.status ?? "all"} />
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">{t("none")}</div>
        ) : (
          <div className="hidden md:block">
            <div className={`${GRID} border-b border-[var(--color-line)] bg-gray-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-gray-500`}>
              <div>{t("cols.code")}</div>
              <div>{t("cols.date")}</div>
              <div>{t("cols.lines")}</div>
              <div>{t("cols.supplier")}</div>
              <div>{t("cols.po_ref")}</div>
              <div>{t("cols.received_by")}</div>
              <div>{t("cols.status")}</div>
            </div>
            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/goods-receipts/${r.id}`}
                className={`${GRID} border-b border-[var(--color-line-soft)] px-4 py-2.5 text-xs hover:bg-gray-50`}
              >
                <div className="font-semibold text-[#059669]">{r.code ?? "—"}</div>
                <div className="text-gray-500">{r.receipt_date}</div>
                <div className="truncate text-gray-700">{r.item_summary || "—"}</div>
                <div className="truncate text-gray-700">{r.supplier}</div>
                <div className="truncate font-mono text-[11px] text-gray-500">
                  {r.po_ref ?? "—"}
                </div>
                <div className="truncate text-gray-500">
                  {r.received_by_name ?? "—"}
                </div>
                <div>
                  <ReceiptStatusBadge status={r.status} />
                </div>
              </Link>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <div className="md:hidden">
            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/goods-receipts/${r.id}`}
                className="flex flex-col gap-1 border-b border-[var(--color-line-soft)] p-3 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#059669]">{r.code ?? "—"}</span>
                  <ReceiptStatusBadge status={r.status} />
                </div>
                <div className="truncate text-gray-700">{r.item_summary || "—"}</div>
                <div className="flex justify-between text-gray-500">
                  <span>{r.supplier}</span>
                  <span>{r.receipt_date}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
