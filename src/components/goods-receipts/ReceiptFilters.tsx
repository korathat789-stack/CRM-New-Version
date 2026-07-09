"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";

export function ReceiptFilters({ status }: { status: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useTranslations("goodsReceipts");
  const [, startTransition] = useTransition();

  const update = (val: string) => {
    const next = new URLSearchParams(params);
    if (!val || val === "all") next.delete("status");
    else next.set("status", val);
    startTransition(() =>
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    );
  };

  return (
    <label className="flex items-center gap-1.5 rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs text-gray-600">
      <span className="font-semibold">{t("cols.status")}:</span>
      <select
        value={status}
        onChange={(e) => update(e.target.value)}
        className="bg-transparent text-xs outline-none"
      >
        <option value="all">{t("status.all")}</option>
        <option value="pending">{t("status.pending")}</option>
        <option value="approved">{t("status.approved")}</option>
        <option value="rejected">{t("status.rejected")}</option>
      </select>
    </label>
  );
}
