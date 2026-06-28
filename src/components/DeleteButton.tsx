"use client";

import { useState, useTransition } from "react";

export default function DeleteButton({
  action,
  customerName,
}: {
  action: () => Promise<void>;
  customerName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">Delete {customerName}?</span>
      <button
        type="button"
        onClick={() => startTransition(() => action())}
        disabled={pending}
        className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
      >
        Cancel
      </button>
    </div>
  );
}
