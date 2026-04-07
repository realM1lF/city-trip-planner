import type { Trip, TripStop } from "@/types/trip";

/** Standard-Ankunft für den ersten Stopp eines Tages (Tagesanker). */
export const DEFAULT_DAY_START_ARRIVAL = "09:00";

function sortByOrder(stops: TripStop[]): TripStop[] {
  return [...stops].sort((a, b) => a.order - b.order);
}

function hasArrival(st: TripStop | undefined): boolean {
  return Boolean(st?.arrivalTime?.trim());
}

/**
 * Hält genau eine Anker-`arrivalTime` am ersten Stopp: Nach Reihenfolgeänderung
 * wandert die Zeit mit zum neuen ersten Stopp; der frühere erste Stopp verliert sie.
 */
export function migrateAnchorAfterReorder(
  prevSorted: TripStop[],
  nextStops: TripStop[]
): TripStop[] {
  if (nextStops.length === 0) return nextStops;

  const nextSorted = sortByOrder(nextStops);
  const oldFirst = prevSorted[0];
  const newFirst = nextSorted[0];
  if (!oldFirst || !newFirst || oldFirst.id === newFirst.id) {
    return nextStops;
  }

  const byId = new Map<string, TripStop>(
    nextStops.map((s) => [s.id, { ...s }])
  );

  const nf = byId.get(newFirst.id);
  const of = byId.get(oldFirst.id);
  if (!nf) return nextStops;

  const anchorFromOld = oldFirst.arrivalTime?.trim() || undefined;

  if (!hasArrival(nf) && anchorFromOld) {
    nf.arrivalTime = anchorFromOld;
  }

  if (of && of.id !== nf.id && hasArrival(of)) {
    const cleared = { ...of };
    delete cleared.arrivalTime;
    byId.set(of.id, cleared);
  }

  return nextStops.map((s) => byId.get(s.id)!);
}

/** Nach Löschen des ersten Stopps: Anker auf den neuen ersten übernehmen. */
export function inheritAnchorAfterRemoveFirst(
  removedFirst: TripStop,
  reindexedStops: TripStop[]
): TripStop[] {
  if (reindexedStops.length === 0) return reindexedStops;

  const anchor = removedFirst.arrivalTime?.trim();
  if (!anchor) return reindexedStops;

  const nextSorted = sortByOrder(reindexedStops);
  const newFirst = nextSorted[0];
  if (!newFirst || hasArrival(newFirst)) return reindexedStops;

  const id = newFirst.id;
  return reindexedStops.map((st) =>
    st.id === id ? { ...st, arrivalTime: anchor } : st
  );
}

/**
 * Entfernt gespeicherte Ankunft/Abreise dort, wo nur Verweildauer + Route gelten:
 * Nicht-Unterkunft ab Index 1: keine Ankunft/Abreise; erster Nicht-Logis: keine Abreise.
 */
export function sanitizeItineraryStopTimesForTrip(trip: Trip): Trip {
  return {
    ...trip,
    days: trip.days.map((day) => {
      const sorted = sortByOrder(day.stops);
      const indexById = new Map(sorted.map((s, i) => [s.id, i]));
      return {
        ...day,
        stops: day.stops.map((s) => {
          const idx = indexById.get(s.id);
          if (idx === undefined || s.isAccommodation) return s;
          const next: TripStop = { ...s };
          if (idx > 0) {
            delete next.arrivalTime;
            delete next.departureTime;
          } else {
            delete next.departureTime;
          }
          return next;
        }),
      };
    }),
  };
}

/** Legacy / Import: Jeder Tag mit Stopps hat einen gesetzten Anker am ersten Stopp. */
export function ensureFirstStopArrivalOnAllDays(trip: Trip): Trip {
  const withAnchors: Trip = {
    ...trip,
    days: trip.days.map((day) => {
      if (day.stops.length === 0) return day;
      const sorted = sortByOrder(day.stops);
      const first = sorted[0]!;
      if (hasArrival(first)) return day;
      const firstId = first.id;
      return {
        ...day,
        stops: day.stops.map((s) =>
          s.id === firstId
            ? { ...s, arrivalTime: DEFAULT_DAY_START_ARRIVAL }
            : s
        ),
      };
    }),
  };
  return sanitizeItineraryStopTimesForTrip(withAnchors);
}
