/**
 * Derive 1–2 uppercase initials from a full name, falling back to the first
 * letter of the email, then "?". Works for Thai and Latin scripts.
 */
export function initialsFrom(
  fullName: string | null,
  email: string | null,
): string {
  const name = fullName?.trim();
  if (name) {
    const letters = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("");
    if (letters) return letters.toUpperCase();
  }
  const mail = email?.trim();
  if (mail) return mail[0].toUpperCase();
  return "?";
}
