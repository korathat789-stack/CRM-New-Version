// MatchPoint CRM is Thai-first; English is the secondary locale.
export const locales = ["th", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "th";

// Cookie that stores the user's chosen UI language.
export const LOCALE_COOKIE = "MPT_LOCALE";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "th" || value === "en";
}
