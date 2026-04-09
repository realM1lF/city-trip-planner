import {
  implicitReturnArrivalTotalMin,
  parseTimeToMinutes,
  type DayItinerary,
} from "@/lib/itinerary-time";
import { implicitReturnFinalStop } from "@/lib/leg-travel-modes";
import { berlinCalendarDateISO } from "@/lib/open-meteo";
import type { TripDay, TripStop } from "@/types/trip";

export type LiveStopWindowStatus =
  | { kind: "atStop"; stopId: string }
  | { kind: "inTransit"; fromStopId: string; toStopId: string }
  | { kind: "before"; nextStopId: string }
  | { kind: "after"; lastStopId: string }
  | { kind: "noToday" }
  | { kind: "noPlan" };

function addUtcCalendarDaysFromIso(
  iso: string,
  deltaDays: number
): { y: number; m: number; d: number } {
  const [y0, m0, d0] = iso.split("-").map(Number);
  if ([y0, m0, d0].some((n) => Number.isNaN(n))) {
    return { y: y0, m: m0, d: d0 };
  }
  const u = Date.UTC(y0, m0 - 1, d0 + deltaDays);
  const x = new Date(u);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() };
}

/**
 * UTC-Zeitstempel für eine Berlin-Wanduhr (Sommer-/Winterzeit über Intl).
 */
export function berlinWallClockToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const read = (ms: number) => {
    const parts = formatter.formatToParts(new Date(ms));
    const get = (t: string) =>
      Number(parts.find((p) => p.type === t)?.value ?? NaN);
    return {
      y: get("year"),
      m: get("month"),
      d: get("day"),
      h: get("hour"),
      min: get("minute"),
    };
  };

  let guess = Date.UTC(year, month - 1, day, hour - 2, minute, 0);
  for (let i = 0; i < 56; i++) {
    const g = read(guess);
    if (
      g.y === year &&
      g.m === month &&
      g.d === day &&
      g.h === hour &&
      g.min === minute
    ) {
      return guess;
    }
    guess += ((day - g.d) * 24 * 60 + (hour - g.h) * 60 + (minute - g.min)) * 60_000;
  }
  return guess;
}

/** Plantag-Start (00:00 Europe/Berlin) + Minuten seit Anker-Mitternacht (inkl. Werte &gt; 1440). */
export function scheduleTotalMinToUtcMs(
  planDayISO: string,
  totalMin: number
): number {
  const extraDays = Math.floor(totalMin / 1440);
  const minsInDay = totalMin % 1440;
  const { y, m, d } = addUtcCalendarDaysFromIso(planDayISO, extraDays);
  const hh = Math.floor(minsInDay / 60);
  const mm = minsInDay % 60;
  return berlinWallClockToUtcMs(y, m, d, hh, mm);
}

/**
 * Abfahrtszeitpunkt für Google Directions (DRIVING/TRANSIT): Plantag + Anker-HH:mm
 * als **Europe/Berlin**-Wandzeit, konsistent zu Live-Fenster und scheduleTotalMinToUtcMs.
 */
export function directionsAnchorDepartureFromPlanDay(
  planDayISO: string | null | undefined,
  firstStopArrivalHHmm: string | undefined
): Date | null {
  const day = planDayISO?.trim();
  const hhmm = firstStopArrivalHHmm?.trim();
  if (!day || !hhmm) return null;
  const totalMin = parseTimeToMinutes(hhmm);
  if (totalMin === null) return null;
  return new Date(scheduleTotalMinToUtcMs(day, totalMin));
}

/** Aktuelle Uhrzeit in Europe/Berlin als „HH:mm“ (für „now“-Schnellwahl). */
export function berlinNowHHmm(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(now);
}

export function getLiveStopWindowStatus(args: {
  planDayDate: string | null;
  sortedStops: TripStop[];
  itinerary: DayItinerary | null;
  day: Pick<TripDay, "implicitReturnToStopId"> | undefined;
  now?: Date;
}): LiveStopWindowStatus {
  const now = args.now ?? new Date();
  const { planDayDate, sortedStops, itinerary, day } = args;
  const trimmedDay = planDayDate?.trim() ?? null;

  if (!trimmedDay) return { kind: "noPlan" };
  if (trimmedDay !== berlinCalendarDateISO(now)) return { kind: "noToday" };
  if (!itinerary || sortedStops.length === 0) return { kind: "noPlan" };

  const nowMs = now.getTime();

  const windows = itinerary.stops.map((s) => ({
    stopId: s.stopId,
    start: scheduleTotalMinToUtcMs(trimmedDay, s.arrivalTotalMin),
    end: scheduleTotalMinToUtcMs(trimmedDay, s.departureTotalMin),
  }));

  /** Normale Stopps: halboffen [start, end); Punktfenster (Ankunft = Abreise): nur exakt `start`. */
  const inStopWindow = (start: number, end: number) =>
    end > start ? nowMs >= start && nowMs < end : nowMs === start;

  for (const w of windows) {
    if (inStopWindow(w.start, w.end)) {
      return { kind: "atStop", stopId: w.stopId };
    }
  }

  if (nowMs < windows[0]!.start) {
    return { kind: "before", nextStopId: windows[0]!.stopId };
  }

  for (let i = 0; i < windows.length - 1; i++) {
    const a = windows[i]!;
    const b = windows[i + 1]!;
    if (nowMs >= a.end && nowMs < b.start) {
      return { kind: "inTransit", fromStopId: a.stopId, toStopId: b.stopId };
    }
  }

  const last = windows[windows.length - 1]!;
  const implicitFinal =
    day && sortedStops.length >= 2
      ? implicitReturnFinalStop(day, sortedStops)
      : null;

  let timelineEndMs = last.end;
  if (implicitFinal && day) {
    const implicitMin = implicitReturnArrivalTotalMin(
      itinerary,
      sortedStops,
      day
    );
    if (implicitMin != null) {
      timelineEndMs = scheduleTotalMinToUtcMs(trimmedDay, implicitMin);
      if (nowMs >= last.end && nowMs < timelineEndMs) {
        return {
          kind: "inTransit",
          fromStopId: last.stopId,
          toStopId: implicitFinal.id,
        };
      }
    }
  }

  if (nowMs >= timelineEndMs) {
    return {
      kind: "after",
      lastStopId: implicitFinal?.id ?? last.stopId,
    };
  }

  return { kind: "after", lastStopId: last.stopId };
}
