import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { canManageInventory } from "@/lib/roles";
import { isSupabaseConfigured } from "@/lib/config";
import { listPendingReceipts, receiptTotalQty } from "@/lib/goodsReceipts";
import { ApprovalActions } from "@/components/goods-receipts/ApprovalActions";

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user.role)) redirect("/inventory");
  const t = await getTranslations("approvals");
  const tg = await getTranslations("goodsReceipts");

  const pending = isSupabaseConfigured() ? await listPendingReceipts() : [];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
      <p className="text-sm text-gray-500">{t("subtitle", { count: pending.length })}</p>

      {pending.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          {t("none")}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
            {t("receiptsHeading")}
          </h2>
          {pending.map((r) => (
            <Card key={r.id}>
              <CardHeader className="justify-between">
                <div>
                  <span className="text-sm font-bold text-gray-900">
                    {r.code ?? tg("detail")}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">{r.supplier}</span>
                </div>
                <ApprovalActions receiptId={r.id} code={r.code ?? ""} />
              </CardHeader>
              <CardBody className="text-xs text-gray-600">
                <div className="mb-2 flex gap-4 text-gray-500">
                  <span>{r.receipt_date}</span>
                  <span>
                    {tg("cols.qty")}: <b className="text-gray-800">{receiptTotalQty(r.items)}</b>
                  </span>
                  <span>
                    {tg("detailView.receivedBy")}: {r.received_by_name ?? "—"}
                  </span>
                </div>
                <ul className="flex flex-col gap-1">
                  {r.items.map((it) => (
                    <li key={it.id} className="flex justify-between">
                      <span className="text-gray-800">
                        {it.product_name}{" "}
                        <span className="text-gray-400">({it.product_code})</span>
                      </span>
                      <span className="font-semibold text-gray-900">
                        {it.qty} {it.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
