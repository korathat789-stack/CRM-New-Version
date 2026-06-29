"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { STAGE_FILTER_OPTIONS, STAGES } from "@/lib/stages";

interface Props {
  q: string;
  status: string;
  owner: string;
  value: string;
  due: string;
  sort: string;
  owners: { id: string; name: string }[];
}

export function ProjectFilters({
  q,
  status,
  owner,
  value,
  due,
  sort,
  owners,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useTranslations("projects");
  const ts = useTranslations();
  const [, startTransition] = useTransition();

  const update = (key: string, val: string) => {
    const next = new URLSearchParams(params);
    if (!val || val === "all") next.delete(key);
    else next.set(key, val);
    startTransition(() =>
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1.5">
        <Search className="h-4 w-4 text-gray-400" aria-hidden />
        <input
          defaultValue={q}
          onChange={(e) => update("q", e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full bg-transparent text-sm outline-none"
          aria-label={t("searchPlaceholder")}
        />
      </div>

      <Select label={t("filters.status")} value={status} onChange={(v) => update("status", v)}>
        {STAGE_FILTER_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s === "all" ? t("filters.all") : ts(STAGES[s].labelKey)}
          </option>
        ))}
      </Select>

      {owners.length > 0 && (
        <Select label={t("filters.owner")} value={owner} onChange={(v) => update("owner", v)}>
          <option value="all">{t("filters.all")}</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      )}

      <Select label={t("filters.value")} value={value} onChange={(v) => update("value", v)}>
        <option value="all">{t("filters.valueAny")}</option>
        <option value="1m">{t("filters.value1m")}</option>
        <option value="5m">{t("filters.value5m")}</option>
      </Select>

      <Select label={t("filters.due")} value={due} onChange={(v) => update("due", v)}>
        <option value="all">{t("filters.dueAll")}</option>
        <option value="overdue">{t("filters.dueOverdue")}</option>
        <option value="quarter">{t("filters.dueQuarter")}</option>
      </Select>

      <Select label={t("filters.sort")} value={sort} onChange={(v) => update("sort", v)}>
        <option value="value">{t("filters.sortValue")}</option>
        <option value="margin">{t("filters.sortMargin")}</option>
        <option value="due">{t("filters.sortDue")}</option>
      </Select>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-1.5 rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs text-gray-600">
      <span className="font-semibold">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-xs outline-none"
      >
        {children}
      </select>
    </label>
  );
}
