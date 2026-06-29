"use client";

import { ErrorView } from "@/components/states/StateViews";

// Error state for app routes, rendered inside the shell (frame W).
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl">
      <ErrorView reset={reset} />
    </div>
  );
}
