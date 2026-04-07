import { cloneTripForPersistence } from "@/lib/persist-trip";
import type {
  MultiModeLegSeconds,
  PersistedPlannerStateV1,
  PersistedPlannerStateV2,
  TravelModeOption,
  Trip,
} from "@/types/trip";

/** Felder aus dem Trip-Store, die als PersistedPlannerStateV2 gespeichert werden. */
export type TripStorePersistSlice = {
  trip: Trip;
  activeDayId: string;
  travelMode: TravelModeOption;
  optimizeWaypoints: boolean;
  routeLegDurationsByDayId: Record<string, number[] | null>;
  multiModeLegSecondsByDayId: Record<string, MultiModeLegSeconds | null>;
};

export function toPersistedPlannerStateV2(
  s: TripStorePersistSlice
): PersistedPlannerStateV2 {
  return {
    version: 2,
    trip: cloneTripForPersistence(s.trip),
    activeDayId: s.activeDayId,
    travelMode: s.travelMode,
    optimizeWaypoints: s.optimizeWaypoints,
    routeLegDurationsByDayId: s.routeLegDurationsByDayId,
    multiModeLegSecondsByDayId: s.multiModeLegSecondsByDayId,
  };
}

export function isPersistedPlannerStateV2(
  x: unknown
): x is PersistedPlannerStateV2 {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.version !== 2) return false;
  if (!o.trip || typeof o.trip !== "object") return false;
  const trip = o.trip as { days?: unknown };
  if (!Array.isArray(trip.days)) return false;
  return true;
}

function isPersistedPlannerStateV1(x: unknown): x is PersistedPlannerStateV1 {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.version !== 1) return false;
  if (!o.trip || typeof o.trip !== "object") return false;
  const trip = o.trip as { days?: unknown };
  if (!Array.isArray(trip.days)) return false;
  return true;
}

/** Rohdaten aus dem zustand-persist Storage (ohne `version: 2` Exportfeld). */
export function persistedV2FromZustandBlob(
  inner: unknown
): PersistedPlannerStateV2 | null {
  if (!inner || typeof inner !== "object") return null;
  const o = inner as Record<string, unknown>;
  if (!o.trip || typeof o.trip !== "object") return null;
  if (typeof o.activeDayId !== "string") return null;
  const trip = o.trip as Trip;
  return {
    version: 2,
    trip,
    activeDayId: o.activeDayId,
    travelMode: (o.travelMode as TravelModeOption) ?? "WALKING",
    optimizeWaypoints: Boolean(o.optimizeWaypoints),
    routeLegDurationsByDayId:
      (o.routeLegDurationsByDayId as Record<string, number[] | null>) ?? {},
    multiModeLegSecondsByDayId:
      (o.multiModeLegSecondsByDayId as Record<
        string,
        MultiModeLegSeconds | null
      >) ?? {},
  };
}

export function normalizePlannerImport(
  raw: unknown
): PersistedPlannerStateV2 | null {
  if (isPersistedPlannerStateV2(raw)) return raw;
  if (isPersistedPlannerStateV1(raw)) {
    return {
      version: 2,
      trip: raw.trip,
      activeDayId: raw.activeDayId,
      travelMode: raw.travelMode,
      optimizeWaypoints: raw.optimizeWaypoints,
    };
  }
  return null;
}
