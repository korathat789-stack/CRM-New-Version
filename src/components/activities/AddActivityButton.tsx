"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import { logActivity } from "@/lib/actions/activity";

const TYPES = ["call", "email", "meeting", "presentation", "zoom", "quotation", "poc", "line", "note"];

export function AddActivityButton({
  customerId,
  opportunityId,
}: {
  customerId: string;
  opportunityId?: string;
}) {
  const t = useTranslations("activity");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const [type, setType] = useState("call");
  const [summary, setSummary] = useState("");
  const [occurredAt, setOccurredAt] = useState(today);
  const [nextStep, setNextStep] = useState("");
  const [quotationNo, setQuotationNo] = useState("");

  const submit = () => {
    startTransition(async () => {
      const res = await logActivity({
        customerId,
        opportunityId,
        type,
        summary,
        occurredAt,
        nextStep,
        quotationNo,
      });
      if (res.ok) {
        toast(tc("saved"));
        setOpen(false);
        setSummary("");
        setNextStep("");
        setQuotationNo("");
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        {t("add")}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="card w-full max-w-md p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 font-bold text-gray-900">{t("title")}</div>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-gray-600">{t("type")}</span>
                  <select value={type} onChange={(e) => setType(e.target.value)} className="input">
                    {TYPES.map((ty) => (
                      <option key={ty} value={ty}>
                        {t(`types.${ty}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-gray-600">{t("date")}</span>
                  <input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className="input" />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-600">
                  {t("summary")} <span className="text-[#dc2626]">*</span>
                </span>
                <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className="input" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-gray-600">{t("nextStep")}</span>
                  <input value={nextStep} onChange={(e) => setNextStep(e.target.value)} className="input" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-gray-600">{t("quotationNo")}</span>
                  <input value={quotationNo} onChange={(e) => setQuotationNo(e.target.value)} className="input" placeholder="Q…" />
                </label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button onClick={submit} disabled={pending || !summary.trim()}>
                {tc("save")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
