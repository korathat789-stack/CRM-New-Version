"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { updateFulfillment } from "@/app/(app)/projects/actions";

const STEPS = ["pending", "delivering", "installing", "closed"];

// Post-Won work tracking (รอส่งของ / รอติดตั้ง / ปิดงาน).
export function FulfillmentEditor({ id, value }: { id: string; value: string }) {
  const t = useTranslations("projects.fulfillment");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const set = (status: string) =>
    startTransition(async () => {
      const res = await updateFulfillment(id, status);
      if (res.ok) {
        toast(tc("saved"));
        router.refresh();
      }
    });

  return (
    <div className="rounded-md border border-dashed border-gray-300 p-3">
      <div className="mb-2 text-xs font-bold text-gray-600">{t("label")}</div>
      <div className="flex flex-wrap gap-1.5">
        {STEPS.map((s) => (
          <button
            key={s}
            disabled={pending}
            onClick={() => set(s)}
            className={`pill px-3 py-1 text-xs font-semibold ${
              value === s
                ? "bg-[var(--color-primary)] text-white"
                : "border border-[var(--color-line)] text-gray-500 hover:bg-gray-50"
            }`}
          >
            {t(s)}
          </button>
        ))}
      </div>
    </div>
  );
}
