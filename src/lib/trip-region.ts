import type { Trip } from "@/types/trip";

/** Versucht Stadt/Ort aus einer Google-Places-Anschrift (z. B. „…, 04107 Leipzig, Germany“). */
export function cityHintFromFormattedAddress(formattedAddress: string): string | null {
  const trimmed = formattedAddress.trim();
  if (!trimmed) return null;
  const segments = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return null;

  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]!;
    if (/^(Germany|Deutschland|DE)$/i.test(seg)) continue;
    const plzCity = /\b(\d{4,5})\s+(.+)$/.exec(seg);
    if (plzCity && plzCity[2]) {
      return plzCity[2].trim();
    }
  }

  if (segments.length >= 2) {
    const beforeCountry = segments[segments.length - 2]!;
    if (!/^\d{4,5}$/.test(beforeCountry)) {
      return beforeCountry.replace(/^\d{4,5}\s+/, "").trim() || beforeCountry;
    }
  }

  return segments.length > 1 ? segments[segments.length - 2]! : null;
}

/** Alle Stopps des Trips, flach über Tage. */
function allStopsSortedByDay(trip: Trip) {
  const out: { formattedAddress: string }[] = [];
  for (const day of trip.days) {
    const row = [...day.stops].sort((a, b) => a.order - b.order);
    for (const s of row) {
      out.push(s);
    }
  }
  return out;
}

/**
 * Anzeige z. B. „Leipzig“ oder „Leipzig · Dresden“ — für Kopfzeile / Kontext.
 */
export function tripRegionSummary(trip: Trip): string | null {
  const hints = allStopsSortedByDay(trip)
    .map((s) => cityHintFromFormattedAddress(s.formattedAddress))
    .filter((x): x is string => x != null && x.length > 0);
  if (hints.length === 0) return null;
  const unique: string[] = [];
  for (const h of hints) {
    if (!unique.some((u) => u.toLowerCase() === h.toLowerCase())) {
      unique.push(h);
    }
  }
  return unique.join(" · ");
}
