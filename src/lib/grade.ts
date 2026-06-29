// Customer grade A–F — ONE source of truth. Grade is auto-derived from revenue
// and is read-only in the UI. The basis (Annual or Lifetime) is switchable per
// view/report. Bands are expressed in integer satang (see lib/money.ts).
//
// NOTE: the SQL function public.customer_grade() in the migration mirrors these
// default bands so the database can filter/index by grade. If you change the
// numbers, update both places (or move bands fully into the grade_bands table).

import { bahtToSatang } from "./money";

export type Grade = "A" | "B" | "C" | "D" | "F";
export type GradeBasis = "annual" | "lifetime";

export interface GradeBand {
  grade: Grade;
  /** inclusive lower bound, in satang */
  min: number;
}

// Defaults from wireframe frame G (≥฿5M = A, etc.). Highest band first.
export const DEFAULT_GRADE_BANDS: GradeBand[] = [
  { grade: "A", min: bahtToSatang(5_000_000) },
  { grade: "B", min: bahtToSatang(2_000_000) },
  { grade: "C", min: bahtToSatang(500_000) },
  { grade: "D", min: bahtToSatang(100_000) },
  { grade: "F", min: 0 },
];

export function computeGrade(
  amountSatang: number | null | undefined,
  bands: GradeBand[] = DEFAULT_GRADE_BANDS
): Grade {
  const amount = amountSatang ?? 0;
  for (const band of bands) {
    if (amount >= band.min) return band.grade;
  }
  return "F";
}

export function gradeForCustomer(
  customer: { annual_revenue?: number | null; lifetime_revenue?: number | null },
  basis: GradeBasis,
  bands: GradeBand[] = DEFAULT_GRADE_BANDS
): Grade {
  const amount =
    basis === "annual" ? customer.annual_revenue : customer.lifetime_revenue;
  return computeGrade(amount, bands);
}

const GRADE_COLOR_VAR: Record<Grade, string> = {
  A: "var(--color-grade-a)",
  B: "var(--color-grade-b)",
  C: "var(--color-grade-c)",
  D: "var(--color-grade-d)",
  F: "var(--color-grade-f)",
};

export function gradeColor(grade: Grade): string {
  return GRADE_COLOR_VAR[grade];
}

export const ALL_GRADES: Grade[] = ["A", "B", "C", "D", "F"];
