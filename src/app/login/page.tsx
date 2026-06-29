import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LocaleToggle } from "@/components/shell/LocaleToggle";
import { signInWithPassword } from "@/lib/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const t = await getTranslations("auth");

  const errorKey =
    error === "notConfigured"
      ? "notConfigured"
      : error === "invalid"
        ? "invalid"
        : null;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-end">
          <LocaleToggle />
        </div>
        <Card className="p-6">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[7px] bg-[var(--color-primary)] text-white font-bold">
              M
            </span>
            <div>
              <div className="font-bold text-gray-900">{t("signInTitle")}</div>
              <div className="text-xs text-gray-500">{t("signInSubtitle")}</div>
            </div>
          </div>

          {errorKey && (
            <div className="mb-4 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]">
              {t(errorKey)}
            </div>
          )}

          <form action={signInWithPassword} className="flex flex-col gap-3">
            <input type="hidden" name="next" value={next ?? "/dashboard"} />
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">
                {t("email")}
              </span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="rounded-md border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">
                {t("password")}
              </span>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                className="rounded-md border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
              />
            </label>
            <Button type="submit" className="mt-1 w-full">
              {t("signIn")}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
