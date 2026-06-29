"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/lib/actions/locale";
import { locales, type Locale } from "@/i18n/config";

// Bilingual TH / EN switch. Writes the locale cookie via a server action.
export function LocaleToggle() {
  const active = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <div className="inline-flex overflow-hidden rounded-md border border-[var(--color-line)] text-xs">
      {locales.map((loc: Locale) => (
        <button
          key={loc}
          disabled={pending}
          onClick={() => startTransition(() => setLocale(loc))}
          className={`px-2.5 py-1.5 font-semibold uppercase ${
            active === loc
              ? "bg-[var(--color-primary)] text-white"
              : "text-gray-500 hover:bg-gray-50"
          }`}
          aria-pressed={active === loc}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
