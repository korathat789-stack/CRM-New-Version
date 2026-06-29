"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

export function PeriodToggle({ period }: { period: "month" | "quarter" | "year" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useTranslations("dashboard.period");

  const set = (p: string) => {
    const next = new URLSearchParams(params);
    next.set("period", p);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="flex overflow-hidden rounded-md border border-[var(--color-line)] text-xs">
      {(["month", "quarter", "year"] as const).map((p) => (
        <button
          key={p}
          onClick={() => set(p)}
          className={`px-3 py-1.5 font-semibold ${
            period === p ? "bg-[var(--color-primary)] text-white" : "text-gray-500"
          }`}
        >
          {t(p)}
        </button>
      ))}
    </div>
  );
}
