"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { GradeBadge } from "@/components/ui/GradeBadge";
import { CustomerPicker } from "./CustomerPicker";
import {
  createQuotation,
  type QuotationFormState,
  type PickerCustomer,
} from "@/app/(app)/quotations/actions";
import {
  computeTotals,
  lineAmount,
  CREDIT_TERMS,
  type VatMode,
} from "@/lib/quotation";
import { formatBaht, parseBahtToSatang } from "@/lib/money";
import type { Grade } from "@/lib/grade";

interface Line {
  description: string;
  unit_price: string;
  qty: string;
  discount_pct: string;
}

const EMPTY_LINE: Line = { description: "", unit_price: "", qty: "1", discount_pct: "0" };
const INITIAL: QuotationFormState = { ok: false };

export function QuotationForm({
  vatRate,
  autoNumber,
  today,
}: {
  vatRate: number;
  autoNumber: string;
  today: string;
}) {
  const t = useTranslations("quotations.form");
  const tc = useTranslations("common");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState(createQuotation, INITIAL);
  const [customer, setCustomer] = useState<PickerCustomer | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [vatMode, setVatMode] = useState<VatMode>("excluded");
  const [creditTerm, setCreditTerm] = useState(30);
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);
  const [intent, setIntent] = useState<"issue" | "draft">("issue");

  const numericLines = useMemo(
    () =>
      lines.map((l) => ({
        unit_price: parseBahtToSatang(l.unit_price) ?? 0,
        qty: Number(l.qty) || 0,
        discount_pct: Number(l.discount_pct) || 0,
      })),
    [lines]
  );

  const totals = useMemo(
    () => computeTotals(numericLines, vatRate, vatMode),
    [numericLines, vatRate, vatMode]
  );

  const linesPayload = JSON.stringify(lines);

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  const removeLine = (i: number) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const submit = (which: "issue" | "draft") => {
    setIntent(which);
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  };

  return (
    <form ref={formRef} action={formAction} className="mx-auto max-w-3xl">
      <input type="hidden" name="customer_id" value={customer?.id ?? ""} />
      <input type="hidden" name="vat_mode" value={vatMode} />
      <input type="hidden" name="credit_term" value={creditTerm} />
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="lines" value={linesPayload} />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] p-4">
          <div className="flex-1">
            <div className="text-base font-bold text-gray-900">{t("title")}</div>
            <div className="text-xs text-gray-500">
              {autoNumber} · {t("autoNumber")}
            </div>
          </div>
          <Button type="button" variant="ghost" onClick={() => submit("draft")} disabled={pending}>
            {t("saveDraft")}
          </Button>
          <Button type="button" onClick={() => submit("issue")} disabled={pending}>
            {t("issue")}
          </Button>
        </div>

        <CardBody className="flex flex-col gap-4">
          {/* Customer link */}
          <div>
            <div className="mb-1 text-xs font-semibold text-gray-600">
              {t("customer")} <span className="text-[#dc2626]">*</span>{" "}
              <span className="font-normal text-gray-400">· {t("customerLinkNote")}</span>
            </div>
            {customer ? (
              <div className="flex items-center gap-2.5 rounded-md border border-[var(--color-primary)] bg-blue-50 px-3 py-2.5">
                <GradeBadge grade={customer.grade as Grade} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-gray-900">
                    {customer.name}
                  </div>
                  <div className="truncate text-xs text-gray-500">
                    {customer.code}
                    {customer.tax_id ? ` · ${customer.tax_id}` : ""}
                    {customer.province ? ` · ${customer.province}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="text-xs font-semibold text-[var(--color-primary)]"
                >
                  {t("change")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="w-full rounded-md border border-dashed border-gray-300 px-3 py-3 text-left text-sm text-gray-400 hover:border-[var(--color-primary)]"
              >
                {t("selectCustomer")}
              </button>
            )}
            <div className="mt-1 text-[10px] text-gray-400">{t("autofillNote")}</div>
          </div>

          {/* Meta row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">{t("quotationDate")}</span>
              <input type="date" name="quotation_date" defaultValue={today} className="input" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">{t("expiringDate")}</span>
              <input type="date" name="expiring_date" className="input" />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">{t("creditTerm")}</span>
              <div className="flex overflow-hidden rounded-md border border-[var(--color-line)] text-xs">
                {CREDIT_TERMS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setCreditTerm(d)}
                    className={`flex-1 py-2 font-semibold ${
                      creditTerm === d
                        ? "bg-[var(--color-primary)] text-white"
                        : "text-gray-500"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="overflow-hidden rounded-md border border-dashed border-gray-300">
            <div className="grid grid-cols-[0.4fr_2.4fr_1.2fr_0.7fr_0.8fr_1.2fr_0.3fr] gap-2 bg-gray-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              <div>{t("lineNo")}</div>
              <div>{t("description")}</div>
              <div className="text-right">{t("unitPrice")}</div>
              <div className="text-right">{t("qty")}</div>
              <div className="text-right">{t("discount")}</div>
              <div className="text-right">{t("amount")}</div>
              <div />
            </div>
            {lines.map((l, i) => (
              <div
                key={i}
                className="grid grid-cols-[0.4fr_2.4fr_1.2fr_0.7fr_0.8fr_1.2fr_0.3fr] items-center gap-2 border-b border-[var(--color-line-soft)] px-3 py-2 text-xs"
              >
                <div className="text-gray-400">{i + 1}</div>
                <input
                  value={l.description}
                  onChange={(e) => updateLine(i, { description: e.target.value })}
                  className="input"
                  placeholder={t("description")}
                />
                <input
                  value={l.unit_price}
                  onChange={(e) => updateLine(i, { unit_price: e.target.value })}
                  inputMode="numeric"
                  className="input text-right"
                  placeholder="0"
                />
                <input
                  value={l.qty}
                  onChange={(e) => updateLine(i, { qty: e.target.value })}
                  inputMode="numeric"
                  className="input text-right"
                />
                <input
                  value={l.discount_pct}
                  onChange={(e) => updateLine(i, { discount_pct: e.target.value })}
                  inputMode="numeric"
                  className="input text-right"
                />
                <div className="text-right font-bold text-gray-900">
                  {formatBaht(lineAmount(numericLines[i]))}
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="text-gray-400 hover:text-[#dc2626]"
                  aria-label={t("removeLine")}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1 px-3 py-2.5 text-xs font-semibold text-[var(--color-primary)]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t("addLine")}
            </button>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="flex w-full max-w-xs flex-col gap-2">
              <Row label={t("subtotal")} value={formatBaht(totals.subtotal)} />
              <div className="flex items-center justify-between text-xs text-gray-700">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">{t("vat", { rate: vatRate })}</span>
                  <div className="flex overflow-hidden rounded border border-[var(--color-line)] text-[10px]">
                    {(["excluded", "included"] as VatMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setVatMode(m)}
                        className={`px-2 py-0.5 font-semibold ${
                          vatMode === m
                            ? "bg-[var(--color-primary)] text-white"
                            : "text-gray-500"
                        }`}
                      >
                        {m === "excluded" ? t("vatExcluded") : t("vatIncluded")}
                      </button>
                    ))}
                  </div>
                </div>
                <b>{formatBaht(totals.vat)}</b>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-2">
                <span className="text-sm font-bold text-gray-900">{t("total")}</span>
                <b className="text-lg text-[var(--color-primary)]">
                  {formatBaht(totals.total)}
                </b>
              </div>
            </div>
          </div>

          {/* Remark + terms */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">{t("remark")}</span>
              <textarea name="remark" rows={3} className="input" placeholder={t("remarkPlaceholder")} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">{t("terms")}</span>
              <textarea name="terms" rows={3} className="input" placeholder={t("termsPlaceholder")} />
            </label>
          </div>

          {state.error && (
            <div className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]">
              {state.error === "customerRequired"
                ? t("customerRequired")
                : state.error === "noLines"
                  ? t("noLines")
                  : t("saveFailed")}
            </div>
          )}
        </CardBody>

        <div className="flex justify-end gap-2 border-t border-[var(--color-line)] px-4 py-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            {tc("cancel")}
          </Button>
        </div>
      </Card>

      {pickerOpen && (
        <CustomerPicker
          onSelect={(c) => {
            setCustomer(c);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs text-gray-700">
      <span className="text-gray-500">{label}</span>
      <b>{value}</b>
    </div>
  );
}
