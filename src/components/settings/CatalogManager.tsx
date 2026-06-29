"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import {
  createCustomerType,
  updateCustomerType,
  deleteCustomerType,
  saveGradeBands,
} from "@/app/(app)/settings/catalog/actions";
import type { CustomerType } from "@/lib/types";

type BandRow = { grade: string; min_baht: string };

export function CatalogManager({
  types,
  annualBands,
  lifetimeBands,
}: {
  types: CustomerType[];
  annualBands: BandRow[];
  lifetimeBands: BandRow[];
}) {
  const t = useTranslations("settings.catalog");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const refresh = () => router.refresh();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast(tc("saved"));
        refresh();
      } else if (res.error === "inUse") {
        toast(t("inUse"), "error");
      } else {
        toast(tc("retry"), "error");
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <CustomerTypes types={types} pending={pending} run={run} t={t} tc={tc} />
      <GradeBands
        annualBands={annualBands}
        lifetimeBands={lifetimeBands}
        pending={pending}
        run={run}
        t={t}
      />
    </div>
  );
}

function CustomerTypes({
  types,
  pending,
  run,
  t,
  tc,
}: {
  types: CustomerType[];
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
  t: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
}) {
  const [draft, setDraft] = useState({ code: "", en: "", th: "" });

  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-bold text-gray-900">{t("customerTypes")}</span>
      </CardHeader>
      <CardBody className="flex flex-col gap-2">
        {types.map((ct) => (
          <TypeRow key={ct.id} type={ct} pending={pending} run={run} t={t} tc={tc} />
        ))}

        {/* Add row */}
        <div className="mt-2 grid grid-cols-[1fr_1.2fr_1.2fr_auto] gap-2 border-t border-[var(--color-line-soft)] pt-3">
          <input
            value={draft.code}
            onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            placeholder={t("code")}
            className="input"
          />
          <input
            value={draft.en}
            onChange={(e) => setDraft({ ...draft, en: e.target.value })}
            placeholder={t("labelEn")}
            className="input"
          />
          <input
            value={draft.th}
            onChange={(e) => setDraft({ ...draft, th: e.target.value })}
            placeholder={t("labelTh")}
            className="input"
          />
          <Button
            disabled={pending || !draft.code || !draft.en || !draft.th}
            onClick={() =>
              run(async () => {
                const r = await createCustomerType({
                  code: draft.code,
                  label_en: draft.en,
                  label_th: draft.th,
                });
                if (r.ok) setDraft({ code: "", en: "", th: "" });
                return r;
              })
            }
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("addType")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function TypeRow({
  type,
  pending,
  run,
  t,
  tc,
}: {
  type: CustomerType;
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
  t: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
}) {
  const [en, setEn] = useState(type.label_en);
  const [th, setTh] = useState(type.label_th);
  const dirty = en !== type.label_en || th !== type.label_th;

  return (
    <div className="grid grid-cols-[1fr_1.2fr_1.2fr_auto] items-center gap-2">
      <span className="truncate text-xs text-gray-400">{type.code}</span>
      <input value={en} onChange={(e) => setEn(e.target.value)} className="input" />
      <input value={th} onChange={(e) => setTh(e.target.value)} className="input" />
      <div className="flex gap-1">
        <Button
          variant="ghost"
          disabled={pending || !dirty}
          onClick={() => run(() => updateCustomerType(type.id, { label_en: en, label_th: th }))}
        >
          {tc("save")}
        </Button>
        <button
          onClick={() => run(() => deleteCustomerType(type.id))}
          disabled={pending}
          aria-label="delete"
          className="px-2 text-gray-300 hover:text-[#dc2626]"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function GradeBands({
  annualBands,
  lifetimeBands,
  pending,
  run,
  t,
}: {
  annualBands: BandRow[];
  lifetimeBands: BandRow[];
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [basis, setBasis] = useState<"annual" | "lifetime">("annual");
  const [rows, setRows] = useState<BandRow[]>(annualBands);

  const switchBasis = (b: "annual" | "lifetime") => {
    setBasis(b);
    setRows(b === "annual" ? annualBands : lifetimeBands);
  };

  return (
    <Card>
      <CardHeader>
        <span className="flex-1 text-sm font-bold text-gray-900">{t("gradeBands")}</span>
        <div className="flex overflow-hidden rounded-md border border-[var(--color-line)] text-xs">
          {(["annual", "lifetime"] as const).map((b) => (
            <button
              key={b}
              onClick={() => switchBasis(b)}
              className={`px-3 py-1.5 font-semibold ${
                basis === b ? "bg-[var(--color-primary)] text-white" : "text-gray-500"
              }`}
            >
              {b === "annual" ? t("basisAnnual") : t("basisLifetime")}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div key={row.grade} className="grid grid-cols-[60px_1fr] items-center gap-2">
            <span className="font-bold text-gray-900">{t("grade")} {row.grade}</span>
            <input
              value={row.grade === "F" ? "0" : row.min_baht}
              disabled={row.grade === "F"}
              onChange={(e) =>
                setRows(rows.map((r, idx) => (idx === i ? { ...r, min_baht: e.target.value } : r)))
              }
              inputMode="numeric"
              className="input text-right disabled:bg-gray-50"
            />
          </div>
        ))}
        <p className="text-[11px] text-gray-400">{t("gradesNote")}</p>
        <div className="flex justify-end">
          <Button disabled={pending} onClick={() => run(() => saveGradeBands(basis, rows))}>
            {t("saveGrades")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
