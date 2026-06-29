import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { LocaleToggle } from "./LocaleToggle";
import { signOut } from "@/lib/actions/auth";
import type { CurrentUser } from "@/lib/auth";

// App top bar: page is rendered below. Shows language switch + signed-in user.
export async function Topbar({ user }: { user: CurrentUser }) {
  const t = await getTranslations();
  const roleLabel = t(`roles.${user.role}`);

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-[var(--color-line)] bg-white px-4">
      <div className="flex-1" />
      <LocaleToggle />
      <div className="hidden text-right sm:block">
        <div className="text-sm font-semibold text-gray-900 leading-tight">
          {user.fullName ?? user.email}
        </div>
        <div className="text-[11px] text-gray-500">{roleLabel}</div>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-line)] text-gray-500 hover:bg-gray-50"
          title={t("common.signOut")}
          aria-label={t("common.signOut")}
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </header>
  );
}
