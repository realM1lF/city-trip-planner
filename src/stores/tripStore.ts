import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  MultiModeLegSeconds,
  TravelModeOption,
  Trip,
  TripDay,
  TripStop,
} from "@/types/trip";
import { createEmptyDay, createId, createInitialTrip } from "@/lib/trip-defaults";
import {
  DEFAULT_DAY_START_ARRIVAL,
  ensureFirstStopArrivalOnAllDays,
  inheritAnchorAfterRemoveFirst,
  migrateAnchorAfterReorder,
} from "@/lib/trip-anchor";
import { remapLegTravelModesAfterStopsChange } from "@/lib/leg-travel-modes";
import { cloneTripForPersistence } from "@/lib/persist-trip";
import {
  sanitizeMultiModeLegSeconds,
  sanitizeRouteLegDurations,
} from "@/lib/route-leg-sanitize";

type TripState = {
  trip: Trip;
  activeDayId: string;
  travelMode: TravelModeOption;
  optimizeWaypoints: boolean;
  /** Hauptroute (gewählter Modus), Sekunden pro Leg — persistent nach Sanitize */
  routeLegDurationsByDayId: Record<string, number[] | null>;
  /** Zusatz: Fuß / Auto / ÖPNV parallel — mitpersistiert (wie Hauptroute) */
  multiModeLegSecondsByDayId: Record<string, MultiModeLegSeconds | null>;
  setTripName: (name: string) => void;
  setActiveDay: (dayId: string) => void;
  addDay: () => void;
  updateDayLabel: (dayId: string, label: string) => void;
  updateDayDate: (dayId: string, date: string | null) => void;
  addStop: (dayId: string, stop: Omit<TripStop, "id" | "order">) => void;
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
  setOptimizeWaypoints: (value: boolean) => void;
  setLegDurations: (dayId: string, seconds: number[] | null) => void;
  setMultiModeLegSeconds: (
    dayId: string,
    value: MultiModeLegSeconds | null
  ) => void;
  replaceTrip: (trip: Trip) => void;
  resetTrip: () => void;
};

function withReindexedStops(stops: TripStop[]): TripStop[] {
  return stops.map((s, i) => ({ ...s, order: i }));
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
        optimizeWaypoints: false,
        routeLegDurationsByDayId: {},
        multiModeLegSecondsByDayId: {},

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
            const order = day.stops.length;
            const stop: TripStop = {
              ...stopData,
              id: createId(),
              order,
              ...(order === 0
                ? {
                    arrivalTime:
                      stopData.arrivalTime?.trim() ||
                      DEFAULT_DAY_START_ARRIVAL,
                  }
                : {}),
            };
            return {
              trip: updateDayInTrip(s.trip, dayId, (d) => {
                const prevSorted = [...d.stops].sort(
                  (a, b) => a.order - b.order
                );
                const newStops = [...d.stops, stop];
                const nextSorted = [...newStops].sort(
                  (a, b) => a.order - b.order
                );
                const legTravelModes = remapLegTravelModesAfterStopsChange(
                  prevSorted,
                  d.legTravelModes,
                  nextSorted,
                  s.travelMode
                );
                return {
                  ...d,
                  stops: newStops,
                  legTravelModes,
                };
              }),
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
            const legTravelModes = remapLegTravelModesAfterStopsChange(
              prevSorted,
              day.legTravelModes,
              next,
              s.travelMode
            );
            return {
              trip: updateDayInTrip(s.trip, dayId, (d) => ({
                ...d,
                stops: next,
                legTravelModes,
              })),
            };
          }),

        updateStop: (dayId, stopId, patch) =>
          set((s) => ({
            trip: updateDayInTrip(s.trip, dayId, (d) => ({
              ...d,
              stops: d.stops.map((st) => {
                if (st.id === stopId) return { ...st, ...patch };
                if (patch.isAccommodation === true) {
                  return { ...st, isAccommodation: false };
                }
                return st;
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
            const legTravelModes = remapLegTravelModesAfterStopsChange(
              prevSorted,
              day.legTravelModes,
              migrated,
              s.travelMode
            );
            return {
              trip: updateDayInTrip(s.trip, dayId, (d) => ({
                ...d,
                stops: migrated,
                legTravelModes,
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
            const legTravelModes = remapLegTravelModesAfterStopsChange(
              prevSorted,
              day.legTravelModes,
              migrated,
              s.travelMode
            );
            return {
              trip: updateDayInTrip(s.trip, dayId, (d) => ({
                ...d,
                stops: migrated,
                legTravelModes,
              })),
            };
          }),

        setTravelMode: (travelMode) =>
          set((s) => {
            const day = s.trip.days.find((d) => d.id === s.activeDayId);
            if (!day) return { travelMode };
            const sorted = [...day.stops].sort((a, b) => a.order - b.order);
            if (sorted.length < 2) {
              return {
                travelMode,
                trip: updateDayInTrip(s.trip, day.id, (d) => ({
                  ...d,
                  legTravelModes: undefined,
                })),
              };
            }
            const modes = Array.from(
              { length: sorted.length - 1 },
              () => travelMode
            );
            return {
              travelMode,
              trip: updateDayInTrip(s.trip, day.id, (d) => ({
                ...d,
                legTravelModes: modes,
              })),
            };
          }),

        setDayLegTravelMode: (dayId, legIndex, mode) =>
          set((s) => {
            const tm = s.travelMode;
            return {
              trip: updateDayInTrip(s.trip, dayId, (d) => {
                const sorted = [...d.stops].sort((a, b) => a.order - b.order);
                const n = sorted.length - 1;
                if (n <= 0 || legIndex < 0 || legIndex >= n) return d;
                const base =
                  d.legTravelModes?.length === n
                    ? [...d.legTravelModes]
                    : Array.from({ length: n }, (_, i) => d.legTravelModes?.[i] ?? tm);
                base[legIndex] = mode;
                return { ...d, legTravelModes: base };
              }),
            };
          }),

        setOptimizeWaypoints: (optimizeWaypoints) => set({ optimizeWaypoints }),

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
            optimizeWaypoints: false,
            routeLegDurationsByDayId: {},
            multiModeLegSecondsByDayId: {},
          });
        },
      };
    },
    {
      name: "gmapsplanner-trip",
      version: 2,
      migrate: (persisted, fromVersion) => {
        type Slice = {
          trip: Trip;
          activeDayId: string;
          travelMode: TravelModeOption;
          optimizeWaypoints: boolean;
          routeLegDurationsByDayId?: Record<string, number[] | null>;
          multiModeLegSecondsByDayId?: Record<string, MultiModeLegSeconds | null>;
        };
        const p = persisted as Partial<Slice>;
        if (fromVersion < 2) {
          return {
            trip: p.trip!,
            activeDayId: p.activeDayId!,
            travelMode: p.travelMode ?? "WALKING",
            optimizeWaypoints: p.optimizeWaypoints ?? false,
            routeLegDurationsByDayId: {},
            multiModeLegSecondsByDayId: {},
          } as Slice;
        }
        return persisted as Slice;
      },
      merge: (persistedState, currentState) => {
        const p = persistedState as Partial<TripState> | null;
        if (!p || typeof p !== "object") return currentState;
        const merged: TripState = {
          ...currentState,
          trip: p.trip ?? currentState.trip,
          activeDayId: p.activeDayId ?? currentState.activeDayId,
          travelMode: p.travelMode ?? currentState.travelMode,
          optimizeWaypoints: p.optimizeWaypoints ?? currentState.optimizeWaypoints,
          routeLegDurationsByDayId:
            p.routeLegDurationsByDayId ??
            currentState.routeLegDurationsByDayId,
          multiModeLegSecondsByDayId:
            p.multiModeLegSecondsByDayId ??
            currentState.multiModeLegSecondsByDayId,
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
        optimizeWaypoints: s.optimizeWaypoints,
        routeLegDurationsByDayId: s.routeLegDurationsByDayId,
        multiModeLegSecondsByDayId: s.multiModeLegSecondsByDayId,
      }),
    }
  )
);
