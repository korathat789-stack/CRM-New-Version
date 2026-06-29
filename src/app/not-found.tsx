import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("states");
  const nav = await getTranslations("nav");
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl font-bold text-gray-900">{t("notFoundTitle")}</h1>
      <p className="mt-2 text-sm text-gray-500">{t("notFoundBody")}</p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
      >
        {nav("dashboard")}
      </Link>
    </div>
  );
}
