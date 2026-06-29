"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { deleteCustomer } from "@/app/(app)/customers/actions";

// Soft-delete confirmation with typed-ID guard (wireframe frame F). The delete
// itself is also enforced server-side (manager/admin only) + by RLS triggers.
export function DeleteCustomerDialog({
  id,
  code,
  name,
}: {
  id: string;
  code: string;
  name: string;
}) {
  const t = useTranslations("customers.delete");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      try {
        await deleteCustomer(id, typed);
      } catch (e) {
        // NEXT_REDIRECT throws on success — re-throw so navigation proceeds.
        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
        const msg = e instanceof Error ? e.message : "";
        setError(msg === "FORBIDDEN" ? t("restricted") : t("mismatch"));
      }
    });
  };

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {tc("delete")}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-sm p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#fee2e2] text-[#dc2626]">
              <Trash2 className="h-5 w-5" aria-hidden />
            </div>
            <div className="font-bold text-gray-900">{t("title")}</div>
            <p className="mt-1.5 text-sm text-gray-500">
              {t("body", { name, code })}
            </p>

            <label className="mt-3 block text-xs text-gray-600">
              {t("typeToConfirm", { code })}
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="input mt-1"
                autoFocus
              />
            </label>

            {error && (
              <div className="mt-2 text-xs text-[#dc2626]">{error}</div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button
                variant="danger"
                disabled={pending || typed.trim() !== code}
                onClick={confirm}
              >
                {t("confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
