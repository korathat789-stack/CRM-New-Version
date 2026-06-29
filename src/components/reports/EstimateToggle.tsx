"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatBahtShort } from "@/lib/money";

// Sales estimate — Quotation + Invoice, Combined / Split toggle (frame P).
export function EstimateToggle({
  quotation,
  invoice,
  combined,
  openQuotes,
}: {
  quotation: number;
  invoice: number;
  combined: number;
  openQuotes: number;
}) {
  const t = useTranslations("reports.sales");
  const [mode, setMode] = useState<"combined" | "split">("combined");

  const quotePct = combined > 0 ? (quotation / combined) * 100 : 0;
  const invoicePct = combined > 0 ? (invoice / combined) * 100 : 0;

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-600">{t("estimate")}</span>
        <div className="flex overflow-hidden rounded-md border border-[var(--color-line)] text-[11px]">
          {(["combined", "split"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 font-semibold ${
                mode === m
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-gray-500"
              }`}
            >
              {m === "combined" ? t("combined") : t("split")}
            </button>
          ))}
        </div>
      </div>

      {mode === "combined" ? (
        <div className="flex items-center gap-2">
          <span className="w-24 text-[11px] text-gray-500">{t("combinedEst")}</span>
          <div className="flex h-3.5 flex-1 overflow-hidden rounded">
            <div style={{ width: `${quotePct}%`, background: "#eab308" }} />
            <div style={{ width: `${invoicePct}%`, background: "#2563eb" }} />
          </div>
          <b className="w-16 text-right text-xs text-gray-900">
            {formatBahtShort(combined)}
          </b>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-md border border-[var(--color-line-soft)] p-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-gray-500">
              <span className="h-2 w-2 rounded-sm bg-[#eab308]" />
              {t("quotationOpen")}
            </div>
            <div className="text-base font-bold text-gray-900">
              {formatBahtShort(quotation)}
            </div>
            <div className="text-[10px] text-gray-400">
              {t("openQuotes", { count: openQuotes })}
            </div>
          </div>
          <div className="rounded-md border border-[var(--color-line-soft)] p-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-gray-500">
              <span className="h-2 w-2 rounded-sm bg-[#2563eb]" />
              {t("invoiceActual")}
            </div>
            <div className="text-base font-bold text-gray-900">
              {formatBahtShort(invoice)}
            </div>
            <div className="text-[10px] text-gray-400">{t("fromAccounting")}</div>
          </div>
        </div>
      )}
      <div className="mt-2 text-[10px] text-gray-400">{t("estimateNote")}</div>
    </div>
  );
}
