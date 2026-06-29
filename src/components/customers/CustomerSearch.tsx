"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { ALL_GRADES, gradeColor, type Grade } from "@/lib/grade";

// Search box + grade filter pills. Both drive URL search params (q, grade) so
// the list is server-rendered and shareable.
export function CustomerSearch({
  q,
  grade,
}: {
  q: string;
  grade: Grade | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useTranslations("customers");
  const [, startTransition] = useTransition();

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    next.delete("sel");
    startTransition(() =>
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    );
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 rounded-md border border-[var(--color-line)] px-2.5 py-2">
        <Search className="h-4 w-4 text-gray-400" aria-hidden />
        <input
          defaultValue={q}
          onChange={(e) => update("q", e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full bg-transparent text-sm outline-none"
          aria-label={t("searchPlaceholder")}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-gray-500">
          {t("gradeFilter")}:
        </span>
        <Pill active={!grade} onClick={() => update("grade", null)}>
          {t("all")}
        </Pill>
        {ALL_GRADES.map((g) => (
          <Pill
            key={g}
            active={grade === g}
            color={gradeColor(g)}
            onClick={() => update("grade", grade === g ? null : g)}
          >
            {g}
          </Pill>
        ))}
      </div>
    </div>
  );
}

function Pill({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="pill px-2.5 py-0.5 text-[11px] font-semibold"
      style={
        active
          ? { background: color ?? "var(--color-primary)", color: "#fff" }
          : { border: "1px solid var(--color-line)", color: "#475569" }
      }
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
