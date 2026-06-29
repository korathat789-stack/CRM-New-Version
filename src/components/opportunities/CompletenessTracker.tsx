"use client";

import { useTranslations } from "next-intl";
import { Check, AlertCircle, Circle } from "lucide-react";
import type { ChecklistItem } from "@/lib/gates";

// % ring + checklist with blockers (wireframe frame U). Blocker keys (the unmet
// requirements for the next stage) are highlighted amber.
export function CompletenessTracker({
  percent,
  items,
  blockerKeys,
}: {
  percent: number;
  items: ChecklistItem[];
  blockerKeys: string[];
}) {
  const t = useTranslations("gates.req");
  const td = useTranslations("opportunities.detail");
  const blockers = new Set(blockerKeys);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(#16a34a ${percent}%, #e5e7eb 0)`,
          }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-bold text-gray-900">
            {percent}%
          </div>
        </div>
        <div>
          <div className="text-sm font-bold text-gray-900">
            {td("completeness")}
          </div>
          {blockerKeys.length > 0 && (
            <div className="text-xs text-[#b45309]">
              {td("blockersBeforeWon", { count: blockerKeys.length })}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col">
        {items.map((item) => {
          const isBlocker = !item.met && blockers.has(item.key);
          return (
            <div
              key={`${item.stage}-${item.key}`}
              className={`flex items-center gap-2.5 border-b border-[var(--color-line-soft)] py-2 text-sm last:border-b-0 ${
                isBlocker ? "bg-[#fffbeb]" : ""
              }`}
            >
              {item.met ? (
                <Check className="h-4 w-4 shrink-0 text-[#16a34a]" aria-hidden />
              ) : isBlocker ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-[#dc2626]" aria-hidden />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-gray-300" aria-hidden />
              )}
              <span
                className={`flex-1 ${item.met ? "text-gray-900" : "text-gray-500"}`}
              >
                {t(item.key)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
