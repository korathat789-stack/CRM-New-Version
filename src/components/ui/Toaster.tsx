"use client";

import { useEffect, useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import type { ToastDetail } from "@/lib/toast";

// Mounts once in the app shell; shows transient success/error toasts.
export function Toaster() {
  const [items, setItems] = useState<ToastDetail[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      setItems((prev) => [...prev, detail]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== detail.id));
      }, 3000);
    };
    window.addEventListener("mpt-toast", onToast);
    return () => window.removeEventListener("mpt-toast", onToast);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2" role="status" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className="card flex items-center gap-2 px-3.5 py-2.5 text-sm"
          style={{
            borderLeft: `3px solid ${t.tone === "success" ? "var(--color-success)" : "var(--color-danger)"}`,
          }}
        >
          {t.tone === "success" ? (
            <Check className="h-4 w-4 text-[var(--color-success)]" aria-hidden />
          ) : (
            <AlertTriangle className="h-4 w-4 text-[var(--color-danger)]" aria-hidden />
          )}
          <span className="text-gray-800">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
