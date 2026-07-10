"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { PRODUCT_CATEGORIES } from "@/lib/inventory-shared";

interface Props {
  q: string;
  category: string;
  status: string;
}

export function InventoryFilters({ q, category, status }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useTranslations("inventory");
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
          placeholder={t("search")}
          className="w-full bg-transparent text-sm outline-none"
          aria-label={t("search")}
        />
      </div>

      <label className="flex items-center gap-1.5 rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs text-gray-600">
        <span className="font-semibold">{t("cols.category")}:</span>
        <select
          value={category}
          onChange={(e) => update("category", e.target.value)}
          className="bg-transparent text-xs outline-none"
        >
          <option value="all">{t("category.all")}</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c.code} value={c.code}>
              {ts(c.labelKey)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs text-gray-600">
        <span className="font-semibold">{t("cols.status")}:</span>
        <select
          value={status}
          onChange={(e) => update("status", e.target.value)}
          className="bg-transparent text-xs outline-none"
        >
          <option value="all">{t("status.all")}</option>
          <option value="in_stock">{t("status.in_stock")}</option>
          <option value="low">{t("status.low")}</option>
          <option value="out">{t("status.out")}</option>
        </select>
      </label>
    </div>
  );
}
