/**
 * URL-sicherer Slug aus dem Reisetitel (ohne Trip-UUID).
 * Nur Kleinbuchstaben, Ziffern und Bindestriche.
 */
export function slugForTripShareTitle(name: string): string {
  const s = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s.length > 0 ? s : "reise";
}
