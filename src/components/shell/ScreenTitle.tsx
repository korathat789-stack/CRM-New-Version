"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { navTitleKey } from "@/lib/roles";

// Localized title of the current screen, derived from the route. Client-only so
// the surrounding Topbar can stay a server component.
export function ScreenTitle() {
  const pathname = usePathname();
  const t = useTranslations();
  return (
    <div className="min-w-0 flex-1 truncate text-[17px] font-bold text-gray-900">
      {t(navTitleKey(pathname))}
    </div>
  );
}
