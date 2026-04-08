import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  MultiModeLegSeconds,
  PersistedPlannerStateV2,
  TravelModeOption,
  Trip,
  TripDay,
  TripStop,
} from "@/types/trip";
import { createEmptyDay, createId, createInitialTrip } from "@/lib/trip-defaults";
import {
  DEFAULT_DAY_START_ARRIVAL,
  ensureFirstStopArrivalOnAllDays,
  findAccommodationStop,
  inheritAnchorAfterRemoveFirst,
  migrateAnchorAfterReorder,
} from "@/lib/trip-anchor";
import {
  reconcileDayLegTravelModesAfterStopsChange,
  expectedRouteLegCount,
  remapLegTravelModesAfterStopsChange,
} from "@/lib/leg-travel-modes";
import { dwellMinutesFromArrivalDepartureHHmm } from "@/lib/itinerary-time";
import { cloneTripForPersistence } from "@/lib/persist-trip";
import {
  sanitizeMultiModeLegSeconds,
  sanitizeRouteLegDurations,
} from "@/lib/route-leg-sanitize";

type TripState = {
  trip: Trip;
  activeDayId: string;
  travelMode: TravelModeOption;
  /** Hauptroute (gewählter Modus), Sekunden pro Leg — persistent nach Sanitize */
  routeLegDurationsByDayId: Record<string, number[] | null>;
  /** Zusatz: Fuß / Auto / ÖPNV parallel — mitpersistiert (wie Hauptroute) */
  multiModeLegSecondsByDayId: Record<string, MultiModeLegSeconds | null>;
  /** Aktuell mit Cloud synchronisierter Trip (Neon), sonst null */
  cloudTripId: string | null;
  setTripName: (name: string) => void;
  setActiveDay: (dayId: string) => void;
  addDay: () => void;
  updateDayLabel: (dayId: string, label: string) => void;
  updateDayDate: (dayId: string, date: string | null) => void;
  addStop: (dayId: string, stop: Omit<TripStop, "id" | "order">) => void;
  /** Neuen Stopp an Position `insertIndex` einfügen (0 = vor dem ersten, `length` = ans Ende). */
  insertStopAt: (
    dayId: string,
    insertIndex: number,
    stop: Omit<TripStop, "id" | "order">
  ) => void;
  removeStop: (dayId: string, stopId: string) => void;
  updateStop: (dayId: string, stopId: string, patch: Partial<TripStop>) => void;
  reorderStops: (dayId: string, fromIndex: number, toIndex: number) => void;
  setStopOrder: (dayId: string, orderedStopIds: string[]) => void;
  setTravelMode: (mode: TravelModeOption) => void;
  setDayLegTravelMode: (
    dayId: string,
    legIndex: number,
    mode: TravelModeOption
  ) => void;
  setLegDurations: (dayId: string, seconds: number[] | null) => void;
  setMultiModeLegSeconds: (
    dayId: string,
    value: MultiModeLegSeconds | null
  ) => void;
  replaceTrip: (trip: Trip) => void;
  resetTrip: () => void;
  setCloudTripId: (id: string | null) => void;
  hydrateFromCloud: (p: PersistedPlannerStateV2) => void;
  /** Rückweg nur auf der Karte (kein zweiter Listen-Stopp); null = aus. */
  setDayImplicitReturn: (dayId: string, stopId: string | null) => void;
  /**
   * Unterkunft vom vorherigen Trip-Tag kopieren (ab Tag 2).
   * Ohne Ankunft/Abreise; leerer Tag → an Position 0, sonst ans Ende.
   */
  carryOverLodgingFromPreviousDay: (dayId: string) => boolean;
};

function withReindexedStops(stops: TripStop[]): TripStop[] {
  return stops.map((s, i) => ({ ...s, order: i }));
}

function mergeStopIntoDayAt(
  day: TripDay,
  insertIndex: number,
  stopData: Omit<TripStop, "id" | "order">
): TripStop[] {
  const sorted = [...day.stops].sort((a, b) => a.order - b.order);
  const idx = Math.max(0, Math.min(insertIndex, sorted.length));
  const stop: TripStop = {
    ...stopData,
    id: createId(),
    order: 0,
  };
  if (idx === 0) {
    if (stopData.isAccommodation) {
      if (stopData.arrivalTime?.trim()) {
        stop.arrivalTime = stopData.arrivalTime.trim();
      } else {
        delete stop.arrivalTime;
      }
    } else {
      stop.arrivalTime =
        stopData.arrivalTime?.trim() || DEFAULT_DAY_START_ARRIVAL;
    }
  }
  const merged = [...sorted.slice(0, idx), stop, ...sorted.slice(idx)];
  return withReindexedStops(merged);
}

function updateDayInTrip(
  trip: Trip,
  dayId: string,
  fn: (day: TripDay) => TripDay
): Trip {
  return {
    ...trip,
    days: trip.days.map((d) => (d.id === dayId ? fn(d) : d)),
  };
}

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => {
      const initial = createInitialTrip();
      const initialDayId = initial.days[0]!.id;

      return {
        trip: initial,
        activeDayId: initialDayId,
        travelMode: "WALKING",
        routeLegDurationsByDayId: {},
        multiModeLegSecondsByDayId: {},
        cloudTripId: null,

        setTripName: (name) =>
          set((s) => ({ trip: { ...s.trip, name } })),

        setActiveDay: (dayId) => set({ activeDayId: dayId }),

        addDay: () =>
          set((s) => {
            const nextIndex = s.trip.days.length + 1;
            const day = createEmptyDay(nextIndex);
            return {
              trip: { ...s.trip, days: [...s.trip.days, day] },
              activeDayId: day.id,
            };
          }),

        updateDayLabel: (dayId, label) =>
          set((s) => ({
            trip: updateDayInTrip(s.trip, dayId, (d) => ({ ...d, label })),
          })),

        updateDayDate: (dayId, date) =>
          set((s) => ({
            trip: updateDayInTrip(s.trip, dayId, (d) => ({ ...d, date })),
          })),

        addStop: (dayId, stopData) =>
          set((s) => {
            const day = s.trip.days.find((d) => d.id === dayId);
            if (!day) return s;
            const prevSorted = [...day.stops].sort((a, b) => a.order - b.order);
            const nextStops = mergeStopIntoDayAt(day, day.stops.length, stopData);
            const legPatch = reconcileDayLegTravelModesAfterStopsChange(
              day,
              prevSorted,
              nextStops,
              s.travelMode
            );
            return {
              trip: updateDayInTrip(s.trip, dayId, (d) => ({
                ...d,
                stops: nextStops,
                ...legPatch,
              })),
            };
          }),

        insertStopAt: (dayId, insertIndex, stopData) =>
          set((s) => {
            const day = s.trip.days.find((d) => d.id === dayId);
            if (!day) return s;
            const prevSorted = [...day.stops].sort((a, b) => a.order - b.order);
            const nextStops = mergeStopIntoDayAt(day, insertIndex, stopData);
            const legPatch = reconcileDayLegTravelModesAfterStopsChange(
              day,
              prevSorted,
              nextStops,
              s.travelMode
            );
            return {
              trip: updateDayInTrip(s.trip, dayId, (d) => ({
                ...d,
                stops: nextStops,
                ...legPatch,
              })),
            };
          }),

        removeStop: (dayId, stopId) =>
          set((s) => {
            const day = s.trip.days.find((d) => d.id === dayId);
            if (!day) return s;
            const prevSorted = [...day.stops].sort(
              (a, b) => a.order - b.order
            );
            const removed = day.stops.find((st) => st.id === stopId);
            const filtered = day.stops.filter((st) => st.id !== stopId);
            let next = withReindexedStops(filtered);
            if (
              removed &&
              prevSorted[0] &&
              prevSorted[0].id === removed.id
            ) {
              next = inheritAnchorAfterRemoveFirst(removed, next);
            }
            const legPatch = reconcileDayLegTravelModesAfterStopsChange(
              day,
              prevSorted,
              next,
              s.travelMode
            );
            return {
              trip: updateDayInTrip(s.trip, dayId, (d) => ({
                ...d,
                stops: next,
                ...legPatch,
              })),
            };
          }),

        updateStop: (dayId, stopId, patch) =>
          set((s) => ({
            trip: updateDayInTrip(s.trip, dayId, (d) => ({
              ...d,
              stops: d.stops.map((st) => {
                if (st.id !== stopId) return st;

                let next: TripStop = { ...st, ...patch };
                const touchesTimes =
                  Object.prototype.hasOwnProperty.call(patch, "arrivalTime") ||
                  Object.prototype.hasOwnProperty.call(patch, "departureTime");
                if (touchesTimes) {
                  const arr = next.arrivalTime?.trim();
                  const dep = next.departureTime?.trim();
                  if (arr && dep) {
                    const synced = dwellMinutesFromArrivalDepartureHHmm(
                      arr,
                      dep
                    );
                    if (synced !== null) next = { ...next, dwellMinutes: synced };
                  }
                }
                return next;
              }),
            })),
          })),

        reorderStops: (dayId, fromIndex, toIndex) =>
          set((s) => {
            const day = s.trip.days.find((d) => d.id === dayId);
            if (!day) return s;
            const prevSorted = [...day.stops].sort(
              (a, b) => a.order - b.order
            );
            const stops = [...prevSorted];
            const [moved] = stops.splice(fromIndex, 1);
            if (!moved) return s;
            stops.splice(toIndex, 0, moved);
            const reindexed = withReindexedStops(stops);
            const migrated = migrateAnchorAfterReorder(prevSorted, reindexed);
            const legPatch = reconcileDayLegTravelModesAfterStopsChange(
              day,
              prevSorted,
              migrated,
              s.travelMode
            );
            return {
              trip: updateDayInTrip(s.trip, dayId, (d) => ({
                ...d,
                stops: migrated,
                ...legPatch,
              })),
            };
          }),

        setStopOrder: (dayId, orderedStopIds) =>
          set((s) => {
            const day = s.trip.days.find((d) => d.id === dayId);
            if (!day) return s;
            const prevSorted = [...day.stops].sort(
              (a, b) => a.order - b.order
            );
            const byId = new Map(day.stops.map((st) => [st.id, st]));
            const next = orderedStopIds
              .map((id) => byId.get(id))
              .filter(Boolean) as TripStop[];
            if (next.length !== day.stops.length) return s;
            const reindexed = withReindexedStops(next);
            const migrated = migrateAnchorAfterReorder(prevSorted, reindexed);
            const legPatch = reconcileDayLegTravelModesAfterStopsChange(
              day,
              prevSorted,
              migrated,
              s.travelMode
            );
            return {
              trip: updateDayInTrip(s.trip, dayId, (d) => ({
                ...d,
                stops: migrated,
                ...legPatch,
              })),
            };
          }),

        setDayImplicitReturn: (dayId, stopId) =>
          set((s) => {
            const day = s.trip.days.find((d) => d.id === dayId);
            if (!day) return s;
            const sorted = [...day.stops].sort((a, b) => a.order - b.order);
            if (sorted.length < 2) return s;
            const tm = s.travelMode;

            if (stopId == null) {
              const baseLen = Math.max(0, sorted.length - 1);
              const modes = [...(day.legTravelModes ?? [])].slice(0, baseLen);
              while (modes.length < baseLen) modes.push(tm);
              return {
                trip: updateDayInTrip(s.trip, dayId, (d) => ({
                  ...d,
                  implicitReturnToStopId: null,
                  legTravelModes: baseLen > 0 ? modes : undefined,
                })),
              };
            }

            const last = sorted[sorted.length - 1]!;
            const target = sorted.find((st) => st.id === stopId);
            if (!target || last.id === target.id) return s;

            const baseLen = sorted.length - 1;
            let modes = [...(day.legTravelModes ?? [])];
            while (modes.length < baseLen) modes.push(tm);
            modes = modes.slice(0, baseLen);
            const hadImplicitExtra =
              (day.legTravelModes?.length ?? 0) > baseLen;
            modes.push(
              hadImplicitExtra
                ? day.legTravelModes![day.legTravelModes!.length - 1]!
                : tm
            );

            return {
              trip: updateDayInTrip(s.trip, dayId, (d) => ({
                ...d,
                implicitReturnToStopId: stopId,
                legTravelModes: modes,
              })),
            };
          }),

        carryOverLodgingFromPreviousDay: (dayId) => {
          let success = false;
          set((s) => {
            const dayIndex = s.trip.days.findIndex((d) => d.id === dayId);
            if (dayIndex <= 0) return s;

            const day = s.trip.days[dayIndex]!;
            const prevDay = s.trip.days[dayIndex - 1]!;
            const prevSorted = [...prevDay.stops].sort((a, b) => a.order - b.order);
            const acc = findAccommodationStop(prevSorted);
            if (!acc) return s;

            const tgtSorted = [...day.stops].sort((a, b) => a.order - b.order);

            const insertIndex = tgtSorted.length === 0 ? 0 : tgtSorted.length;
            const stopData: Omit<TripStop, "id" | "order"> = {
              label: acc.label,
              placeId: acc.placeId,
              lat: acc.lat,
              lng: acc.lng,
              formattedAddress: acc.formattedAddress,
              dwellMinutes: Math.max(0, acc.dwellMinutes),
              isAccommodation: true,
              ...(acc.thumbnailUrl
                ? { thumbnailUrl: acc.thumbnailUrl }
                : { thumbnailUrl: undefined }),
              ...(acc.notes?.trim() ? { notes: acc.notes } : {}),
            };

            const nextStops = mergeStopIntoDayAt(day, insertIndex, stopData);
            const legPatch = reconcileDayLegTravelModesAfterStopsChange(
              day,
              tgtSorted,
              nextStops,
              s.travelMode
            );
            success = true;
            return {
              trip: updateDayInTrip(s.trip, dayId, (d) => ({
                ...d,
                stops: nextStops,
                ...legPatch,
              })),
            };
          });
          return success;
        },

        /** Nur Fallback / Export-Feld; Teilstrecken-Modi pro Karte unter „Route & Vorschläge“. */
        setTravelMode: (travelMode) => set({ travelMode }),

        setDayLegTravelMode: (dayId, legIndex, mode) =>
          set((s) => {
            const tm = s.travelMode;
            return {
              trip: updateDayInTrip(s.trip, dayId, (d) => {
                const sorted = [...d.stops].sort((a, b) => a.order - b.order);
                const nLegs = expectedRouteLegCount(d, sorted);
                if (nLegs <= 0 || legIndex < 0 || legIndex >= nLegs) return d;
                const base =
                  d.legTravelModes?.length === nLegs
                    ? [...d.legTravelModes]
                    : Array.from({ length: nLegs }, (_, i) => d.legTravelModes?.[i] ?? tm);
                base[legIndex] = mode;
                return { ...d, legTravelModes: base };
              }),
            };
          }),

        setLegDurations: (dayId, seconds) =>
          set((s) => ({
            routeLegDurationsByDayId: {
              ...s.routeLegDurationsByDayId,
              [dayId]: seconds,
            },
          })),

        setMultiModeLegSeconds: (dayId, value) =>
          set((s) => ({
            multiModeLegSecondsByDayId: {
              ...s.multiModeLegSecondsByDayId,
              [dayId]: value,
            },
          })),

        replaceTrip: (trip) => {
          const firstDay = trip.days[0];
          set({
            trip: ensureFirstStopArrivalOnAllDays(trip),
            activeDayId: firstDay?.id ?? get().activeDayId,
            routeLegDurationsByDayId: {},
            multiModeLegSecondsByDayId: {},
          });
        },

        resetTrip: () => {
          const t = createInitialTrip();
          set({
            trip: t,
            activeDayId: t.days[0]!.id,
            travelMode: "WALKING",
            routeLegDurationsByDayId: {},
            multiModeLegSecondsByDayId: {},
          });
        },

        setCloudTripId: (id) => set({ cloudTripId: id }),

        hydrateFromCloud: (p) => {
          const trip = ensureFirstStopArrivalOnAllDays(p.trip);
          set({
            trip,
            activeDayId: p.activeDayId,
            travelMode: p.travelMode,
            routeLegDurationsByDayId: sanitizeRouteLegDurations(
              trip,
              p.routeLegDurationsByDayId ?? {}
            ),
            multiModeLegSecondsByDayId: sanitizeMultiModeLegSeconds(
              trip,
              p.multiModeLegSecondsByDayId ?? {}
            ),
          });
        },
      };
    },
    {
      name: "gmapsplanner-trip",
      version: 4,
      migrate: (persisted, fromVersion) => {
        type Slice = {
          trip: Trip;
          activeDayId: string;
          travelMode: TravelModeOption;
          routeLegDurationsByDayId?: Record<string, number[] | null>;
          multiModeLegSecondsByDayId?: Record<string, MultiModeLegSeconds | null>;
          cloudTripId?: string | null;
        };
        let p = {
          ...(persisted as Record<string, unknown>),
        } as Partial<Slice>;
        if (fromVersion < 2) {
          p = {
            trip: p.trip!,
            activeDayId: p.activeDayId!,
            travelMode: p.travelMode ?? "WALKING",
            routeLegDurationsByDayId: {},
            multiModeLegSecondsByDayId: {},
          };
        }
        if (fromVersion < 3) {
          p = { ...p, cloudTripId: p.cloudTripId ?? null };
        }
        return p as Slice;
      },
      merge: (persistedState, currentState) => {
        const p = persistedState as Partial<TripState> | null;
        if (!p || typeof p !== "object") return currentState;
        const merged: TripState = {
          ...currentState,
          trip: p.trip ?? currentState.trip,
          activeDayId: p.activeDayId ?? currentState.activeDayId,
          travelMode: p.travelMode ?? currentState.travelMode,
          routeLegDurationsByDayId:
            p.routeLegDurationsByDayId ??
            currentState.routeLegDurationsByDayId,
          multiModeLegSecondsByDayId:
            p.multiModeLegSecondsByDayId ??
            currentState.multiModeLegSecondsByDayId,
          cloudTripId: p.cloudTripId ?? currentState.cloudTripId,
        };
        merged.trip = ensureFirstStopArrivalOnAllDays(merged.trip);
        merged.routeLegDurationsByDayId = sanitizeRouteLegDurations(
          merged.trip,
          merged.routeLegDurationsByDayId
        );
        merged.multiModeLegSecondsByDayId = sanitizeMultiModeLegSeconds(
          merged.trip,
          merged.multiModeLegSecondsByDayId
        );
        return merged;
      },
      partialize: (s) => ({
        trip: cloneTripForPersistence(s.trip),
        activeDayId: s.activeDayId,
        travelMode: s.travelMode,
        routeLegDurationsByDayId: s.routeLegDurationsByDayId,
        multiModeLegSecondsByDayId: s.multiModeLegSecondsByDayId,
        cloudTripId: s.cloudTripId,
      }),
    }
  )
);
