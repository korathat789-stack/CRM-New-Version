"use client";

import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";

// Static role capability reference (wireframe frame L). This mirrors the policy
// rules enforced by RLS + server actions — it is documentation, not the gate.
const ROWS: { key: string; admin: boolean; manager: boolean; sales: boolean }[] = [
  { key: "viewEdit", admin: true, manager: true, sales: true },
  { key: "delete", admin: true, manager: true, sales: false },
  { key: "authorize", admin: true, manager: true, sales: false },
  { key: "viewReports", admin: true, manager: true, sales: false },
  { key: "settings", admin: true, manager: false, sales: false },
  { key: "manageUsers", admin: true, manager: false, sales: false },
];

export function CapabilityMatrix() {
  const t = useTranslations("users.dialog");
  const tr = useTranslations("roles");

  return (
    <div className="rounded-md border border-dashed border-gray-300 p-3">
      <div className="mb-2.5 text-xs font-bold text-gray-600">
        {t("capabilities")}{" "}
        <span className="font-normal text-gray-400">· {t("reference")}</span>
      </div>
      <div className="grid grid-cols-[1.7fr_1fr_1fr_1fr] gap-1 text-center text-[10px] font-bold uppercase tracking-wide text-gray-500">
        <div className="text-left" />
        <div>{tr("admin")}</div>
        <div>{tr("manager")}</div>
        <div>{tr("sales")}</div>
      </div>
      {ROWS.map((row) => (
        <div
          key={row.key}
          className="grid grid-cols-[1.7fr_1fr_1fr_1fr] items-center gap-1 py-1 text-center text-[11px] text-gray-700"
        >
          <div className="text-left">{t(`cap.${row.key}`)}</div>
          <Mark on={row.admin} />
          <Mark on={row.manager} />
          <Mark on={row.sales} />
        </div>
      ))}
      <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
        {t("rolesNote")}
      </p>
    </div>
  );
}

function Mark({ on }: { on: boolean }) {
  return (
    <div className="flex justify-center">
      {on ? (
        <Check className="h-3.5 w-3.5 text-[#16a34a]" aria-hidden />
      ) : (
        <X className="h-3.5 w-3.5 text-gray-300" aria-hidden />
      )}
    </div>
  );
}
