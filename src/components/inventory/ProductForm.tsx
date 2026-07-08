"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PRODUCT_CATEGORIES } from "@/lib/inventory";
import {
  createProduct,
  updateProduct,
  type ProductFormState,
} from "@/app/(app)/inventory/actions";

const INITIAL: ProductFormState = { ok: false };

export interface ProductFormInitial {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  cost: string;
  sell_price: string;
  safety_stock: string;
  description: string;
  is_active: boolean;
}

export function ProductForm({
  mode,
  initial,
}: {
  mode: "new" | "edit";
  initial?: ProductFormInitial;
}) {
  const t = useTranslations("inventory.form");
  const tc = useTranslations("common");
  const ts = useTranslations();
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    mode === "new" ? createProduct : updateProduct,
    INITIAL
  );

  const errorText =
    state.error === "duplicate"
      ? t("duplicate")
      : state.error
        ? t("required")
        : null;

  return (
    <form action={formAction} className="mx-auto max-w-xl">
      {mode === "edit" && <input type="hidden" name="id" value={initial?.id} />}
      <Card>
        <CardHeader>
          <span className="text-base font-bold text-gray-900">{t("title")}</span>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("code")} required>
              <input name="code" defaultValue={initial?.code} className="input" />
            </Field>
            <Field label={t("category")} required>
              <select name="category" defaultValue={initial?.category ?? ""} className="input">
                <option value="">—</option>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {ts(c.labelKey)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={t("name")} required>
            <input name="name" defaultValue={initial?.name} className="input" />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t("unit")}>
              <input name="unit" defaultValue={initial?.unit ?? "unit"} className="input" />
            </Field>
            <Field label={t("cost")}>
              <input name="cost" defaultValue={initial?.cost} inputMode="numeric" placeholder="0" className="input text-right" />
            </Field>
            <Field label={t("sell")}>
              <input name="sell_price" defaultValue={initial?.sell_price} inputMode="numeric" placeholder="0" className="input text-right" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("safety")}>
              <input name="safety_stock" defaultValue={initial?.safety_stock ?? "0"} inputMode="numeric" placeholder="0" className="input text-right" />
            </Field>
            <label className="flex items-center gap-2 pt-6">
              <input type="hidden" name="is_active" value="false" />
              <input type="checkbox" name="is_active" value="true" defaultChecked={initial?.is_active ?? true} />
              <span className="text-xs font-semibold text-gray-600">{t("active")}</span>
            </label>
          </div>

          <Field label={t("description")}>
            <textarea name="description" defaultValue={initial?.description} rows={2} className="input" />
          </Field>

          {errorText && (
            <div className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]">
              {errorText}
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
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-gray-600">
        {label} {required && <span className="text-[#dc2626]">*</span>}
      </span>
      {children}
    </label>
  );
}
