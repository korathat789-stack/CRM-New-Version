// Minimal client-side toast bus. Components dispatch; <Toaster> renders.
export interface ToastDetail {
  id: number;
  message: string;
  tone: "success" | "error";
}

export function toast(message: string, tone: "success" | "error" = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ToastDetail>("mpt-toast", {
      detail: { id: Date.now() + Math.floor(performance.now()), message, tone },
    })
  );
}
