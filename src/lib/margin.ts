// Margin = (value - cost) / value. Money is integer satang (lib/money.ts).
// Guardrail: when value is 0 (or missing) margin is undefined → display "—",
// never divide by zero.

export type MarginTone = "green" | "amber" | "red";

// Defaults from wireframe: ≥30% green · 20–30% amber · <20% red.
export const MARGIN_GREEN_MIN = 30;
export const MARGIN_AMBER_MIN = 20;

/** Margin as a percentage (0–100), or null when value <= 0. */
export function marginPct(
  valueSatang: number | null | undefined,
  costSatang: number | null | undefined
): number | null {
  const value = valueSatang ?? 0;
  if (value <= 0) return null; // ÷0 guard
  const cost = costSatang ?? 0;
  return ((value - cost) / value) * 100;
}

/** Profit amount in satang (value - cost). */
export function marginAmount(
  valueSatang: number | null | undefined,
  costSatang: number | null | undefined
): number {
  return (valueSatang ?? 0) - (costSatang ?? 0);
}

export function marginTone(pct: number | null): MarginTone | null {
  if (pct == null) return null;
  if (pct >= MARGIN_GREEN_MIN) return "green";
  if (pct >= MARGIN_AMBER_MIN) return "amber";
  return "red";
}

const TONE_COLOR: Record<MarginTone, string> = {
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc2626",
};

export function marginToneColor(tone: MarginTone | null): string {
  return tone ? TONE_COLOR[tone] : "var(--color-ink)";
}

export function formatMarginPct(pct: number | null): string {
  if (pct == null) return "—";
  return `${Math.round(pct)}%`;
}
