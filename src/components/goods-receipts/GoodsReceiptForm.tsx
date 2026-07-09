"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  createGoodsReceipt,
  updateGoodsReceipt,
  type ReceiptFormState,
} from "@/app/(app)/goods-receipts/actions";
import type { ProductOption } from "@/lib/goodsReceipts";

const INITIAL: ReceiptFormState = { ok: false };

export interface ReceiptFormInitial {
  id: string;
  supplier: string;
  po_ref: string;
  receipt_date: string;
  note: string;
  lines: { product_id: string; qty: string; unit: string }[];
}

interface LineRow {
  product_id: string;
  qty: string;
  unit: string;
}

export function GoodsReceiptForm({
  mode,
  products,
  initial,
}: {
  mode: "new" | "edit";
  products: ProductOption[];
  initial?: ReceiptFormInitial;
}) {
  const t = useTranslations("goodsReceipts.form");
  const tc = useTranslations("common");
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    mode === "new" ? createGoodsReceipt : updateGoodsReceipt,
    INITIAL
  );
  const [lines, setLines] = useState<LineRow[]>(
    initial?.lines?.length
      ? initial.lines
      : [{ product_id: "", qty: "", unit: "unit" }]
  );

  const setLine = (i: number, patch: Partial<LineRow>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () =>
    setLines((prev) => [...prev, { product_id: "", qty: "", unit: "unit" }]);
  const removeLine = (i: number) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  // Serialize valid lines to the hidden field the action reads.
  const serialized = JSON.stringify(
    lines
      .filter((l) => l.product_id && Number(l.qty) > 0)
      .map((l) => ({
        product_id: l.product_id,
        qty: Math.trunc(Number(l.qty)),
        unit:
          products.find((p) => p.id === l.product_id)?.unit || l.unit || "unit",
      }))
  );

  return (
    <form action={formAction} className="mx-auto max-w-2xl">
      {mode === "edit" && <input type="hidden" name="id" value={initial?.id} />}
      <input type="hidden" name="lines" value={serialized} />
      <Card>
        <CardHeader>
          <span className="text-base font-bold text-gray-900">
            {mode === "new" ? t("save") : t("save")}
          </span>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">
                {t("supplier")} <span className="text-[#dc2626]">*</span>
              </span>
              <input name="supplier" defaultValue={initial?.supplier} className="input" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">{t("po_ref")}</span>
              <input name="po_ref" defaultValue={initial?.po_ref} className="input" />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">{t("date")}</span>
              <input
                type="date"
                name="receipt_date"
                defaultValue={initial?.receipt_date}
                className="input"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-600">{t("note")}</span>
            <textarea name="note" defaultValue={initial?.note} rows={2} className="input" />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-gray-600">
              {t("lines")} <span className="text-[#dc2626]">*</span>
            </span>
            {lines.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={line.product_id}
                  onChange={(e) => setLine(i, { product_id: e.target.value })}
                  className="input flex-1"
                  aria-label={t("product")}
                >
                  <option value="">{t("product")}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
                <input
                  value={line.qty}
                  onChange={(e) => setLine(i, { qty: e.target.value })}
                  inputMode="numeric"
                  placeholder={t("qty")}
                  className="input w-24 text-right"
                  aria-label={t("qty")}
                />
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-[var(--color-line)] text-gray-500 hover:bg-gray-50"
                  aria-label={t("removeLine")}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1.5 self-start rounded-md border border-dashed border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:border-[var(--color-primary)]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t("addLine")}
            </button>
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
          <Button type="submit" disabled={pending}>
            {t("save")}
          </Button>
        </div>
      </Card>
    </form>
  );
}
