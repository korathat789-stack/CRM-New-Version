import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageInventory } from "@/lib/roles";
import { ProductForm } from "@/components/inventory/ProductForm";

export default async function NewProductPage() {
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user.role)) redirect("/inventory");
  const t = await getTranslations("inventory");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold text-gray-900">{t("newProduct")}</h1>
      <ProductForm mode="new" />
    </div>
  );
}
