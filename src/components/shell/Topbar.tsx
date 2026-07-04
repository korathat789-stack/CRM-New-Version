import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { LocaleToggle } from "./LocaleToggle";
import { ScreenTitle } from "./ScreenTitle";
import { signOut } from "@/lib/actions/auth";

// App top bar: screen title on the left, language switch on the right. On
// desktop the signed-in user and logout live in the Sidebar footer; since the
// sidebar is hidden below `md`, a compact logout is shown here on mobile only so
// signing out is always reachable. Space right of LocaleToggle is otherwise
// reserved for a future notifications control.
export async function Topbar() {
  const t = await getTranslations("common");
  return (
    <header className="sticky top-0 z-10 flex h-[58px] items-center gap-4 border-b border-[var(--color-line)] bg-white px-6">
      <ScreenTitle />
      <LocaleToggle />
      <form action={signOut} className="md:hidden">
        <button
          type="submit"
          title={t("signOut")}
          aria-label={t("signOut")}
          className="flex h-9 w-9 items-center justify-center rounded-[.5rem] border border-[var(--color-line)] text-gray-500 hover:bg-gray-50"
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </header>
  );
}
