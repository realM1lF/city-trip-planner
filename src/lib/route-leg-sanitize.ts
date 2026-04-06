import type { MultiModeLegSeconds, Trip } from "@/types/trip";

/** Passt gecachte Leg-Dauern an den aktuellen Trip an (nach Reload oder Stopp-Änderung). */
export function sanitizeRouteLegDurations(
  trip: Trip,
  raw: Record<string, number[] | null>
): Record<string, number[] | null> {
  const next: Record<string, number[] | null> = {};

  for (const day of trip.days) {
    const prev = raw[day.id];
    const expect = Math.max(0, day.stops.length - 1);
    if (expect === 0) {
      if (prev !== undefined) next[day.id] = null;
      continue;
    }
    if (Array.isArray(prev) && prev.length === expect) {
      next[day.id] = prev;
    } else if (prev !== undefined) {
      next[day.id] = null;
    }
  }

  return next;
}

/** Wie sanitizeRouteLegDurations, für Fuß-/Auto-/ÖPNV-Vergleichsdauern pro Tag. */
export function sanitizeMultiModeLegSeconds(
  trip: Trip,
  raw: Record<string, MultiModeLegSeconds | null>
): Record<string, MultiModeLegSeconds | null> {
  const next: Record<string, MultiModeLegSeconds | null> = {};

  for (const day of trip.days) {
    const expect = Math.max(0, day.stops.length - 1);
    const prev = raw[day.id];
    if (expect === 0) {
      if (prev !== undefined) next[day.id] = null;
      continue;
    }
    if (prev == null) continue;
    const ok =
      prev.walking.length === expect &&
      prev.driving.length === expect &&
      prev.transit.length === expect;
    next[day.id] = ok ? prev : null;
  }

  return next;
}
