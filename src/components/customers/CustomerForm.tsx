"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { GradeBadge } from "@/components/ui/GradeBadge";
import { computeGrade, gradeColor } from "@/lib/grade";
import { parseBahtToSatang } from "@/lib/money";
import type { CustomerFormState } from "@/app/(app)/customers/actions";
import type { CustomerType } from "@/lib/types";

type Action = (
  prev: CustomerFormState,
  formData: FormData
) => Promise<CustomerFormState>;

interface Props {
  action: Action;
  mode: "new" | "edit";
  types: CustomerType[];
  provinces: string[];
  customerCode?: string | null;
  initial?: {
    name: string;
    tax_id: string;
    type_id: string;
    province: string;
    annual_revenue: string;
    lifetime_revenue: string;
    source: string;
    industry: string;
    notes: string;
    address: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    contact_line: string;
  };
}

const INITIAL: CustomerFormState = { ok: false };

export function CustomerForm({
  action,
  mode,
  types,
  provinces,
  customerCode,
  initial,
}: Props) {
  const t = useTranslations("customers.form");
  const tc = useTranslations("common");
  const isThai = useLocale() === "th";
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [annual, setAnnual] = useState(initial?.annual_revenue ?? "");
  const [allowDuplicate, setAllowDuplicate] = useState(false);

  const grade = computeGrade(parseBahtToSatang(annual) ?? 0);
  const fieldErr = (k: string) => state.fieldErrors?.[k];
  const typeLabel = (ct: CustomerType) => (isThai ? ct.label_th : ct.label_en);

  return (
    <form ref={formRef} action={formAction} className="mx-auto max-w-2xl">
      <input type="hidden" name="allow_duplicate" value={String(allowDuplicate)} />
      <Card>
        <CardHeader>
          <span className="text-base font-bold text-gray-900">
            {mode === "new" ? t("newTitle") : t("editTitle")}
          </span>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <Field label={t("name")} required error={fieldErr("name") && t("errRequired")}>
            <input
              name="name"
              defaultValue={initial?.name}
              className="input"
              autoComplete="off"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("customerId")}>
              <div className="input bg-gray-50 text-gray-500">
                {customerCode ?? `(${t("auto")})`}
              </div>
            </Field>
            <Field label={t("taxId")} error={fieldErr("tax_id") && t("errTaxId")}>
              <input
                name="tax_id"
                defaultValue={initial?.tax_id}
                inputMode="numeric"
                placeholder={t("taxIdHint")}
                className="input"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("type")} required error={fieldErr("type_id") && t("errRequired")}>
              <select name="type_id" defaultValue={initial?.type_id ?? ""} className="input">
                <option value="">{t("select")}</option>
                {types.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {typeLabel(ct)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("province")}>
              <select name="province" defaultValue={initial?.province ?? ""} className="input">
                <option value="">{t("select")}</option>
                {provinces.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Sales insight + auto grade (read-only) */}
          <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-3">
            <div className="mb-2 text-xs font-bold text-gray-600">
              {t("salesInsight")}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <Field label={t("annualRevenue")}>
                <input
                  name="annual_revenue"
                  value={annual}
                  onChange={(e) => setAnnual(e.target.value)}
                  inputMode="numeric"
                  placeholder="8,400,000"
                  className="input bg-white"
                />
              </Field>
              <div className="flex flex-col">
                <span className="mb-1 text-xs font-semibold text-gray-600">
                  {t("grade")}
                </span>
                <div
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-md border bg-white px-3 sm:min-h-[38px]"
                  style={{ borderColor: gradeColor(grade) }}
                >
                  <GradeBadge grade={grade} size="sm" />
                  <span className="text-xs text-gray-500">{t("gradeAuto")}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("lifetimeRevenue")}>
                <input
                  name="lifetime_revenue"
                  defaultValue={initial?.lifetime_revenue}
                  inputMode="numeric"
                  placeholder="—"
                  className="input bg-white"
                />
              </Field>
              <Field label={`${t("source")} / ${t("industry")}`}>
                <div className="grid grid-cols-2 gap-2">
                  <input name="source" defaultValue={initial?.source} placeholder={t("source")} className="input bg-white" />
                  <input name="industry" defaultValue={initial?.industry} placeholder={t("industry")} className="input bg-white" />
                </div>
              </Field>
            </div>
          </div>

          <Field label={t("address")}>
            <textarea name="address" defaultValue={initial?.address} rows={2} className="input" />
          </Field>

          {/* Primary contact */}
          <div className="rounded-md border border-dashed border-gray-300 p-3">
            <div className="mb-2 text-xs font-bold text-gray-600">
              {t("contactTitle")}
            </div>
            <div className="flex flex-col gap-3">
              <Field label={t("contactName")}>
                <input name="contact_name" defaultValue={initial?.contact_name} className="input" />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label={t("contactEmail")}>
                  <input name="contact_email" type="email" defaultValue={initial?.contact_email} className="input" />
                </Field>
                <Field label={t("contactPhone")}>
                  <input name="contact_phone" defaultValue={initial?.contact_phone} className="input" />
                </Field>
                <Field label={t("contactLine")}>
                  <input name="contact_line" defaultValue={initial?.contact_line} className="input" />
                </Field>
              </div>
            </div>
          </div>

          <Field label={t("notes")}>
            <textarea name="notes" defaultValue={initial?.notes} rows={2} className="input" />
          </Field>

          {state.duplicate && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs text-[#92400e]">
              <span className="flex-1">
                {t("dupWarning", {
                  name: state.duplicate.code ?? state.duplicate.name,
                })}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAllowDuplicate(true);
                  requestAnimationFrame(() => formRef.current?.requestSubmit());
                }}
                className="font-semibold text-[var(--color-primary)] underline"
              >
                {t("saveAnyway")}
              </button>
            </div>
          )}

          {state.error && (
            <div className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]">
              {t("saveFailed")}
            </div>
          )}
        </CardBody>
        <div className="flex justify-end gap-2 border-t border-[var(--color-line)] px-4 py-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {t("save")}
          </Button>
        </div>
      </Card>
    </form>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | false;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-gray-600">
        {label}
        {required && <span className="text-[#dc2626]"> *</span>}
      </span>
      {children}
      {error && <span className="text-[11px] text-[#dc2626]">{error}</span>}
    </label>
  );
}
