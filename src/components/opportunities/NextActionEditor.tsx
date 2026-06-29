"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import { updateNextAction } from "@/app/(app)/opportunities/actions";

export function NextActionEditor({ id, value }: { id: string; value: string }) {
  const t = useTranslations("opportunities.form");
  const tc = useTranslations("common");
  const tt = useTranslations("tasks");
  const router = useRouter();
  const [date, setDate] = useState(value);
  const [pending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const overdue = date && date < today;

  const save = () =>
    startTransition(async () => {
      const res = await updateNextAction(id, date);
      if (res.ok) {
        toast(tc("saved"));
        router.refresh();
      }
    });

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-gray-300 p-3">
      <label className="flex flex-1 flex-col gap-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          {t("nextActionDate")}
          {overdue && (
            <span className="pill bg-[#fee2e2] px-1.5 text-[10px] font-bold text-[#b91c1c]">
              {tt("overdue")}
            </span>
          )}
        </span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input"
        />
      </label>
      <Button variant="ghost" disabled={pending} onClick={save}>
        {tc("save")}
      </Button>
    </div>
  );
}
