import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Pencil } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { canManageInventory } from "@/lib/roles";
import { getGoodsReceipt } from "@/lib/goodsReceipts";
import { canEditReceipt } from "@/lib/goodsReceipts-shared";
import { ReceiptStatusBadge } from "@/components/goods-receipts/ReceiptStatusBadge";

export default async function GoodsReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user.role)) redirect("/inventory");

  const receipt = await getGoodsReceipt(id);
  if (!receipt) notFound();
  const t = await getTranslations("goodsReceipts");
  const tv = await getTranslations("goodsReceipts.detailView");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {receipt.code ?? t("detail")}
          </h1>
          <div className="mt-1">
            <ReceiptStatusBadge status={receipt.status} />
          </div>
        </div>
        {canEditReceipt(receipt.status) && (
          <Link href={`/goods-receipts/${receipt.id}/edit`}>
            <Button variant="ghost">
              <Pencil className="h-4 w-4" aria-hidden />
              {t("edit")}
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <span className="text-sm font-bold text-gray-900">{receipt.supplier}</span>
        </CardHeader>
        <CardBody className="flex flex-col gap-3 text-sm">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Info label={tv("poRef")} value={receipt.po_ref ?? "—"} />
            <Info label={t("cols.date")} value={receipt.receipt_date} />
            <Info label={tv("receivedBy")} value={receipt.received_by_name ?? "—"} />
            <Info
              label={tv("approvedBy")}
              value={receipt.approved_by_name ?? "—"}
            />
          </div>
          <div className="mt-2 overflow-hidden rounded-md border border-[var(--color-line)]">
            <div className="grid grid-cols-[2fr_1fr] bg-gray-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              <div>{t("form.product")}</div>
              <div className="text-right">{t("form.qty")}</div>
            </div>
            {receipt.items.map((it) => (
              <div
                key={it.id}
                className="grid grid-cols-[2fr_1fr] border-t border-[var(--color-line-soft)] px-3 py-2 text-xs"
              >
                <div>
                  <div className="font-semibold text-gray-900">{it.product_name}</div>
                  <div className="text-[10px] text-gray-400">{it.product_code}</div>
                </div>
                <div className="text-right font-bold text-gray-900">
                  {it.qty} {it.unit}
                </div>
              </div>
            ))}
          </div>
          {receipt.note && <p className="text-xs text-gray-500">{receipt.note}</p>}
        </CardBody>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div className="text-gray-800">{value}</div>
    </div>
  );
}
