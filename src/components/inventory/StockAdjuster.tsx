"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import { adjustStock } from "@/app/(app)/inventory/actions";

export function StockAdjuster({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const t = useTranslations("inventory.adjust");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const qty = parseInt(amount, 10);
    if (!Number.isInteger(qty) || qty <= 0) {
      toast(t("invalid"), "error");
      return;
    }
    startTransition(async () => {
      const res = await adjustStock(productId, sign * qty, note);
      if (res.ok) {
        toast(tc("saved"));
        setOpen(false);
        setAmount("");
        setNote("");
        router.refresh();
      } else {
        toast(t(res.error === "insufficient" ? "insufficient" : "invalid"), "error");
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-[var(--color-line)] px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
      >
        {t("action")}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl">
        <div className="mb-3 text-sm font-bold text-gray-900">
          {t("title")} — {productName}
        </div>
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSign(1)}
            className={`flex h-9 w-9 items-center justify-center rounded-md border ${sign === 1 ? "border-[var(--color-primary)] bg-blue-50" : "border-[var(--color-line)]"}`}
            aria-label="add"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setSign(-1)}
            className={`flex h-9 w-9 items-center justify-center rounded-md border ${sign === -1 ? "border-[var(--color-primary)] bg-blue-50" : "border-[var(--color-line)]"}`}
            aria-label="subtract"
          >
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
            placeholder={t("delta")}
            className="input flex-1 text-right"
            aria-label={t("delta")}
          />
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("note")}
          className="input mb-3 w-full"
          aria-label={t("note")}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {tc("cancel")}
          </Button>
          <Button type="button" disabled={pending} onClick={submit}>
            {t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
