import { cache } from "react";
import { createClient } from "./supabase/server";
import {
  DEFAULT_GRADE_BANDS,
  type GradeBand,
  type GradeBasis,
  type Grade,
} from "./grade";
import type { CustomerType } from "./types";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Grade bands for a basis, read from the grade_bands config table (one source
 * of truth). Falls back to lib/grade defaults when unconfigured or on error.
 */
export const getGradeBands = cache(
  async (basis: GradeBasis): Promise<GradeBand[]> => {
    if (!isSupabaseConfigured()) return DEFAULT_GRADE_BANDS;
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("grade_bands")
        .select("grade, min_satang")
        .eq("basis", basis)
        .order("min_satang", { ascending: false });
      if (!data || data.length === 0) return DEFAULT_GRADE_BANDS;
      return data.map((row) => ({
        grade: row.grade as Grade,
        min: row.min_satang as number,
      }));
    } catch {
      return DEFAULT_GRADE_BANDS;
    }
  }
);

export const getCustomerTypes = cache(async (): Promise<CustomerType[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("customer_types")
      .select("id, code, label_en, label_th, sort")
      .order("sort");
    return data ?? [];
  } catch {
    return [];
  }
});

export const getDefaultGradeBasis = cache(async (): Promise<GradeBasis> => {
  if (!isSupabaseConfigured()) return "annual";
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("app_config")
      .select("grade_basis")
      .single();
    return (data?.grade_basis as GradeBasis) ?? "annual";
  } catch {
    return "annual";
  }
});

export const getVatRatePct = cache(async (): Promise<number> => {
  if (!isSupabaseConfigured()) return 7;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("app_config")
      .select("vat_rate_pct")
      .single();
    return data?.vat_rate_pct ?? 7;
  } catch {
    return 7;
  }
});
