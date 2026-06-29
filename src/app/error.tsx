"use client";

import { ErrorView } from "@/components/states/StateViews";

// Global error boundary (Error state for every route, per frame W).
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md p-6 sm:py-24">
      <ErrorView reset={reset} />
    </div>
  );
}
