import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageInventory } from "@/lib/roles";
import { getProduct } from "@/lib/inventory";
import { formatMoney2 } from "@/lib/money";
import { ProductForm } from "@/components/inventory/ProductForm";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user.role)) redirect("/inventory");

  const product = await getProduct(id);
  if (!product) notFound();
  const t = await getTranslations("inventory");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold text-gray-900">{t("editProduct")}</h1>
      <ProductForm
        mode="edit"
        initial={{
          id: product.id,
          code: product.code,
          name: product.name,
          category: product.category,
          unit: product.unit,
          cost: formatMoney2(product.cost),
          sell_price: formatMoney2(product.sell_price),
          safety_stock: String(product.safety_stock),
          description: product.description ?? "",
          is_active: product.is_active,
        }}
      />
    </div>
  );
}
