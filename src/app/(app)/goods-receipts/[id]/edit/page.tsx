import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageInventory } from "@/lib/roles";
import { getGoodsReceipt, listProductOptions } from "@/lib/goodsReceipts";
import { canEditReceipt } from "@/lib/goodsReceipts-shared";
import { GoodsReceiptForm } from "@/components/goods-receipts/GoodsReceiptForm";

export default async function EditGoodsReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user.role)) redirect("/inventory");

  const [receipt, products] = await Promise.all([
    getGoodsReceipt(id),
    listProductOptions(),
  ]);
  if (!receipt) notFound();
  if (!canEditReceipt(receipt.status)) redirect(`/goods-receipts/${id}`);
  const t = await getTranslations("goodsReceipts");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-xl font-bold text-gray-900">{t("edit")}</h1>
      <GoodsReceiptForm
        mode="edit"
        products={products}
        initial={{
          id: receipt.id,
          supplier: receipt.supplier,
          po_ref: receipt.po_ref ?? "",
          receipt_date: receipt.receipt_date,
          note: receipt.note ?? "",
          lines: receipt.items.map((i) => ({
            product_id: i.product_id,
            qty: String(i.qty),
            unit: i.unit,
          })),
        }}
      />
    </div>
  );
}
