// Money is stored everywhere as an INTEGER number of satang (1 baht = 100
// satang). Never use floats for money. All formatting goes through here.

export const SATANG_PER_BAHT = 100;

export function bahtToSatang(baht: number): number {
  return Math.round(baht * SATANG_PER_BAHT);
}

export function satangToBaht(satang: number): number {
  return satang / SATANG_PER_BAHT;
}

/** Full grouped baht, e.g. ฿1,850,000. Returns "—" for null/undefined. */
export function formatBaht(satang: number | null | undefined): string {
  if (satang == null) return "—";
  const baht = Math.round(satangToBaht(satang));
  return `฿${baht.toLocaleString("en-US")}`;
}

/**
 * Short baht with M / K suffix, e.g. ฿8.4M, ฿850K, ฿120.
 * Returns "฿—" for null/undefined (used for empty value cells).
 */
export function formatBahtShort(satang: number | null | undefined): string {
  if (satang == null) return "฿—";
  const baht = satangToBaht(satang);
  const abs = Math.abs(baht);
  const sign = baht < 0 ? "-" : "";

  if (abs >= 1_000_000) {
    return `${sign}฿${trim(abs / 1_000_000)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}฿${trim(abs / 1_000)}K`;
  }
  return `${sign}฿${Math.round(abs).toLocaleString("en-US")}`;
}

// Drop a trailing ".0" so 8.0 → "8" but 8.4 → "8.4".
function trim(value: number): string {
  return value
    .toFixed(2)
    .replace(/\.?0+$/, "")
    .replace(/(\.\d)\d$/, "$1");
}

/** Parse a user-typed baht string ("8,400,000") into integer satang. */
export function parseBahtToSatang(input: string): number | null {
  const cleaned = input.replace(/[^0-9.-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const baht = Number(cleaned);
  if (!Number.isFinite(baht)) return null;
  return bahtToSatang(baht);
}
