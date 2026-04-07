import {
  expectedRouteLegCount,
  getValidImplicitReturnTarget,
} from "@/lib/leg-travel-modes";
import { DEFAULT_DAY_START_ARRIVAL } from "@/lib/trip-anchor";
import type { TripDay, TripStop } from "@/types/trip";

/** Minuten seit Tagesbeginn (kann >1440 für „über Mitternacht“). */
export type StopSchedule = {
  stopId: string;
  arrivalTotalMin: number;
  departureTotalMin: number;
};

export type LegSchedule = {
  fromStopId: string;
  toStopId: string;
  travelMinutes: number;
};

export type DayItinerary = {
  stops: StopSchedule[];
  legs: LegSchedule[];
};

/** Reine Routen-Ankunft: Abfahrt am Vorgänger + Teilstrecke (nur für Index ≥ 1). */
export function chainArrivalTotalMinForStopIndex(
  itinerary: DayItinerary,
  stopIndex: number
): number | null {
  if (stopIndex < 1) return null;
  const prev = itinerary.stops[stopIndex - 1];
  const leg = itinerary.legs[stopIndex - 1];
  if (!prev || !leg) return null;
  return prev.departureTotalMin + leg.travelMinutes;
}

/** Abreise laut aktueller Gesamtrechnung (Overrides + Verweildauer). */
export function computedDepartureTotalMinForStopIndex(
  itinerary: DayItinerary,
  stopIndex: number
): number | null {
  const row = itinerary.stops[stopIndex];
  return row ? row.departureTotalMin : null;
}

export type ItineraryResult =
  | { ok: true; itinerary: DayItinerary }
  | {
      ok: false;
      reason: "no_stops" | "no_anchor" | "no_legs";
    };

/** Parst „HH:mm“ zu Minuten ab Mitternacht. */
export function parseTimeToMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min) || h > 47 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Verweildauer in Minuten aus „Bin da“ + „Bin gegangen“ (HH:mm).
 * Liegt die Abreise vor der Ankunft auf dem 24h‑Zifferblatt, wird einmal +24h angenommen
 * (typ. über Mitternacht). Liegen beide im erweiterten Format (z. B. 25:00–27:00), gilt die direkte Differenz.
 */
export function dwellMinutesFromArrivalDepartureHHmm(
  arrivalHHmm: string,
  departureHHmm: string
): number | null {
  const a = parseTimeToMinutes(arrivalHHmm);
  const b = parseTimeToMinutes(departureHHmm);
  if (a === null || b === null) return null;
  let d = b - a;
  if (d < 0) d += 1440;
  return Math.max(0, Math.round(d));
}

/** Anzeige z.B. 13:05 oder 25:00 (über Mitternacht). */
export function formatScheduleMinutes(totalMin: number): string {
  const rounded = Math.round(totalMin);
  const h = Math.floor(rounded / 60);
  const m = Math.abs(rounded % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatTimeWindow(
  arrivalMin: number,
  departureMin: number
): string {
  return `${formatScheduleMinutes(arrivalMin)}–${formatScheduleMinutes(departureMin)}`;
}

/** Nur Ankunft aus einer `formatTimeWindow`-Zeile („HH:mm–HH:mm“, Trenner = En-Dash U+2013). */
export function arrivalTimeFromWindowLabel(windowLabel: string): string {
  const sep = "\u2013";
  const i = windowLabel.indexOf(sep);
  return (i >= 0 ? windowLabel.slice(0, i) : windowLabel).trim();
}

export function travelMinutesFromLegSeconds(sec: number): number {
  return Math.max(1, Math.ceil(sec / 60));
}

/**
 * Ein Pfad für alle Stopptypen:
 * - Index 0: `arrivalTime` ist Anker (Tagesbeginn / Check-in), außer **nur Unterkunft
 *   ohne Zeit** → intern `09:00` wie {@link DEFAULT_DAY_START_ARRIVAL} (Fortführung).
 * - Index ≥ 1: Kette `prevDep + Leg`; optional `arrivalTime` → `max(Kette, parse)` (nie vor der Fahrt).
 * - Abreise: optional `departureTime` → `max(Ankunft, parse)`; sonst `Ankunft + dwellMinutes`.
 */
export function computeDayItinerary(
  sortedStops: TripStop[],
  legDurationSeconds: number[] | null | undefined,
  day?: Pick<TripDay, "implicitReturnToStopId">
): ItineraryResult {
  if (sortedStops.length === 0) {
    return { ok: false, reason: "no_stops" };
  }

  const st0 = sortedStops[0]!;
  const parsedAnchor0 = st0.arrivalTime?.trim()
    ? parseTimeToMinutes(st0.arrivalTime.trim())
    : null;
  let anchor0: number;
  if (parsedAnchor0 !== null) {
    anchor0 = parsedAnchor0;
  } else if (st0.isAccommodation) {
    const fallback = parseTimeToMinutes(DEFAULT_DAY_START_ARRIVAL);
    if (fallback === null) {
      return { ok: false, reason: "no_anchor" };
    }
    anchor0 = fallback;
  } else {
    return { ok: false, reason: "no_anchor" };
  }

  if (sortedStops.length >= 2) {
    const expect = expectedRouteLegCount(day ?? { implicitReturnToStopId: null }, sortedStops);
    if (!legDurationSeconds || legDurationSeconds.length !== expect) {
      return { ok: false, reason: "no_legs" };
    }
  }

  const stops: StopSchedule[] = [];
  const legs: LegSchedule[] = [];

  let arrival = anchor0;

  for (let i = 0; i < sortedStops.length; i++) {
    const st = sortedStops[i]!;

    if (i >= 1) {
      const prevDep = stops[i - 1]!.departureTotalMin;
      const sec = legDurationSeconds![i - 1] ?? 0;
      const chainArrival = prevDep + travelMinutesFromLegSeconds(sec);
      const parsedArr = st.arrivalTime?.trim()
        ? parseTimeToMinutes(st.arrivalTime.trim())
        : null;
      arrival =
        parsedArr !== null
          ? Math.max(chainArrival, parsedArr)
          : chainArrival;
    }

    const dwell = Math.max(0, st.dwellMinutes);
    const depParsed = st.departureTime?.trim()
      ? parseTimeToMinutes(st.departureTime.trim())
      : null;
    const departure =
      depParsed !== null ? Math.max(arrival, depParsed) : arrival + dwell;
    stops.push({
      stopId: st.id,
      arrivalTotalMin: arrival,
      departureTotalMin: departure,
    });

    if (i < sortedStops.length - 1) {
      const sec = legDurationSeconds![i] ?? 0;
      const travelMinutes = travelMinutesFromLegSeconds(sec);
      legs.push({
        fromStopId: st.id,
        toStopId: sortedStops[i + 1]!.id,
        travelMinutes,
      });
    }
  }

  const implicitTarget = getValidImplicitReturnTarget(
    day ?? { implicitReturnToStopId: null },
    sortedStops
  );
  if (implicitTarget) {
    const sec = legDurationSeconds![sortedStops.length - 1] ?? 0;
    legs.push({
      fromStopId: sortedStops[sortedStops.length - 1]!.id,
      toStopId: implicitTarget.id,
      travelMinutes: travelMinutesFromLegSeconds(sec),
    });
  }

  return { ok: true, itinerary: { stops, legs } };
}

/**
 * Ankunftszeit (Minuten seit Tagesbeginn) am Ziel des impliziten Rückwegs,
 * aus Abfahrt am letzten Listen‑Stopp + letzte Teilstrecke.
 */
export function implicitReturnArrivalTotalMin(
  itinerary: DayItinerary,
  sortedStops: TripStop[],
  day: Pick<TripDay, "implicitReturnToStopId">
): number | null {
  const target = getValidImplicitReturnTarget(day, sortedStops);
  if (!target || sortedStops.length < 2) return null;
  const { stops, legs } = itinerary;
  if (legs.length === 0) return null;
  const lastLeg = legs[legs.length - 1]!;
  if (lastLeg.toStopId !== target.id) return null;
  const lastIdx = sortedStops.length - 1;
  const lastSched = stops[lastIdx];
  if (!lastSched) return null;
  return lastSched.departureTotalMin + lastLeg.travelMinutes;
}

/**
 * HH:mm für Google Directions am ersten Stopp; fehlende Ankunft nur bei Unterkunft
 * → {@link DEFAULT_DAY_START_ARRIVAL}.
 */
export function anchorHHmmForFirstStopDirections(
  firstStop: TripStop | undefined
): string | undefined {
  if (!firstStop) return undefined;
  const t = firstStop.arrivalTime?.trim();
  if (t) return t;
  if (firstStop.isAccommodation) return DEFAULT_DAY_START_ARRIVAL;
  return undefined;
}

/** Kombiniert TripDay-Datum + erster Stopp-Ankunft für departureTime (Directions). */
export function buildAnchorDepartureDate(
  dayDate: string | null,
  firstStopArrivalHHmm: string | undefined
): Date | null {
  if (!dayDate || !firstStopArrivalHHmm) return null;
  const mins = parseTimeToMinutes(firstStopArrivalHHmm);
  if (mins === null) return null;
  const parts = dayDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, mo, d] = parts;
  if (y == null || mo == null || d == null) return null;
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return new Date(y, mo - 1, d, hh, mm, 0, 0);
}
