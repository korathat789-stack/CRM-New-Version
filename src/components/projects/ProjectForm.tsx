"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { GradeBadge } from "@/components/ui/GradeBadge";
import { CustomerPicker } from "@/components/quotations/CustomerPicker";
import { createProject } from "@/app/(app)/projects/actions";
import type { PickerCustomer } from "@/app/(app)/quotations/actions";
import { ALL_STAGES, STAGES } from "@/lib/stages";
import type { Grade } from "@/lib/grade";

const INITIAL: { ok: boolean; error?: string } = { ok: false };

export function ProjectForm() {
  const t = useTranslations("projects.form");
  const tc = useTranslations("common");
  const ts = useTranslations();
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createProject, INITIAL);
  const [customer, setCustomer] = useState<PickerCustomer | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <form action={formAction} className="mx-auto max-w-xl">
      <input type="hidden" name="customer_id" value={customer?.id ?? ""} />
      <Card>
        <CardHeader>
          <span className="text-base font-bold text-gray-900">{t("title")}</span>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <div>
            <div className="mb-1 text-xs font-semibold text-gray-600">
              {t("customer")} <span className="text-[#dc2626]">*</span>
            </div>
            {customer ? (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="flex w-full items-center gap-2.5 rounded-md border border-[var(--color-primary)] bg-blue-50 px-3 py-2.5 text-left"
              >
                <GradeBadge grade={customer.grade as Grade} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-gray-900">
                    {customer.name}
                  </div>
                  <div className="truncate text-xs text-gray-500">{customer.code}</div>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="w-full rounded-md border border-dashed border-gray-300 px-3 py-3 text-left text-sm text-gray-400 hover:border-[var(--color-primary)]"
              >
                {t("selectCustomer")}
              </button>
            )}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-600">
              {t("name")} <span className="text-[#dc2626]">*</span>
            </span>
            <input name="name" className="input" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-600">{t("stage")}</span>
            <select name="stage" defaultValue="inquiry" className="input">
              {ALL_STAGES.map((s) => (
                <option key={s} value={s}>
                  {ts(STAGES[s].labelKey)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumField name="value" label={t("value")} />
            <NumField name="cost" label={t("cost")} />
            <NumField name="budget" label={t("budget")} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">{t("dueDate")}</span>
              <input type="date" name="due_date" className="input" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">{t("estDate")}</span>
              <input type="date" name="est_date" className="input" />
            </label>
          </div>

          {state.error && (
            <div className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]">
              {t("required")}
            </div>
          )}
        </CardBody>
        <div className="flex justify-end gap-2 border-t border-[var(--color-line)] px-4 py-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={pending || !customer}>
            {t("save")}
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

function NumField({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-gray-600">{label}</span>
      <input name={name} inputMode="numeric" placeholder="0" className="input text-right" />
    </label>
  );
}
