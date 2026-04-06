import type { Trip, TripDay } from "@/types/trip";

export function createId(): string {
  return crypto.randomUUID();
}

export function createEmptyDay(index: number): TripDay {
  return {
    id: createId(),
    label: `Tag ${index}`,
    date: null,
    stops: [],
  };
}

export function createInitialTrip(): Trip {
  return {
    id: createId(),
    name: "Neuer Städtetrip",
    days: [createEmptyDay(1)],
  };
}
