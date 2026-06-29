"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { GradeBasis } from "@/lib/grade";

// Switches the grade basis (Annual / Lifetime) via the `basis` URL param so the
// choice is per-view and server-rendered.
export function GradeBasisToggle({ basis }: { basis: GradeBasis }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useTranslations("grade");

  const set = (value: GradeBasis) => {
    const next = new URLSearchParams(params);
    next.set("basis", value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="inline-flex overflow-hidden rounded-md border border-[var(--color-line)] text-xs">
      {(["annual", "lifetime"] as GradeBasis[]).map((b) => (
        <button
          key={b}
          onClick={() => set(b)}
          className={`px-3 py-1.5 font-semibold ${
            basis === b
              ? "bg-[var(--color-primary)] text-white"
              : "text-gray-500 hover:bg-gray-50"
          }`}
          aria-pressed={basis === b}
        >
          {b === "annual" ? t("basisAnnual") : t("basisLifetime")}
        </button>
      ))}
    </div>
  );
}
