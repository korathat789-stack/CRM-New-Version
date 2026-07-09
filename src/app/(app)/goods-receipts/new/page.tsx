import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageInventory } from "@/lib/roles";
import { listProductOptions } from "@/lib/goodsReceipts";
import { GoodsReceiptForm } from "@/components/goods-receipts/GoodsReceiptForm";

export default async function NewGoodsReceiptPage() {
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user.role)) redirect("/inventory");
  const t = await getTranslations("goodsReceipts");
  const products = await listProductOptions();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-xl font-bold text-gray-900">{t("new")}</h1>
      <GoodsReceiptForm mode="new" products={products} />
    </div>
  );
}
