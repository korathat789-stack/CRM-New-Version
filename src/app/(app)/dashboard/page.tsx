import { getTranslations } from "next-intl/server";
import { Card, CardBody } from "@/components/ui/Card";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
      <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>

      <Card className="mt-5">
        <CardBody>
          <div className="text-base font-semibold text-gray-900">
            {t("welcome")}
          </div>
          <p className="mt-1 text-sm text-gray-500">{t("foundationNote")}</p>
        </CardBody>
      </Card>
    </div>
  );
}
