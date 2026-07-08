import { getTranslations } from "next-intl/server";
import { ImportManager } from "@/components/settings/ImportManager";

export default async function ImportPage() {
  const t = await getTranslations("import");
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500">{t("subtitle")}</p>
      </div>
      <ImportManager />
    </div>
  );
}
