"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

export function PnlViewToggle({ view }: { view: "month" | "quarter" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useTranslations("reports.pnl");

  const set = (v: "month" | "quarter") => {
    const next = new URLSearchParams(params);
    next.set("view", v);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="flex overflow-hidden rounded-md border border-[var(--color-line)] text-[11px]">
      {(["month", "quarter"] as const).map((v) => (
        <button
          key={v}
          onClick={() => set(v)}
          className={`px-2.5 py-1.5 font-semibold ${
            view === v ? "bg-[var(--color-primary)] text-white" : "text-gray-500"
          }`}
        >
          {v === "month" ? t("month") : t("quarter")}
        </button>
      ))}
    </div>
  );
}
