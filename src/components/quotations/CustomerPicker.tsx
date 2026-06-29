"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Search } from "lucide-react";
import { GradeBadge } from "@/components/ui/GradeBadge";
import {
  searchCustomersForPicker,
  type PickerCustomer,
} from "@/app/(app)/quotations/actions";
import type { Grade } from "@/lib/grade";

// Picks a customer from the SAME customers table (wireframe Z2).
export function CustomerPicker({
  onSelect,
  onClose,
}: {
  onSelect: (c: PickerCustomer) => void;
  onClose: () => void;
}) {
  const t = useTranslations("quotations.picker");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickerCustomer[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const handle = setTimeout(() => {
      startTransition(async () => {
        setResults(await searchCustomersForPicker(q));
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--color-line)] p-3">
          <div className="flex items-center gap-2 rounded-md border border-[var(--color-primary)] px-2.5 py-2">
            <Search className="h-4 w-4 text-gray-400" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="flex w-full items-center gap-2.5 border-b border-[var(--color-line-soft)] px-3 py-2.5 text-left text-sm hover:bg-gray-50"
            >
              <GradeBadge grade={c.grade as Grade} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-gray-900">
                  {c.name}
                </div>
                <div className="truncate text-xs text-gray-500">
                  {c.code}
                  {c.province ? ` · ${c.province}` : ""}
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-[var(--color-line)] px-3 py-2.5 text-xs">
          <span className="text-gray-400">{t("sameTable")}</span>
          <Link
            href="/customers/new"
            className="font-semibold text-[var(--color-primary)]"
          >
            + {t("newCustomer")}
          </Link>
        </div>
      </div>
    </div>
  );
}
