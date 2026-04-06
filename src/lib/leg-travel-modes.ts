import type { TravelModeOption, TripDay, TripStop } from "@/types/trip";

/** Behält Modus je Paar (fromId,toId) nach Umordnung / Entfernen / Hinzufügen bei. */
export function remapLegTravelModesAfterStopsChange(
  prevSorted: TripStop[],
  prevModes: TravelModeOption[] | undefined,
  nextSorted: TripStop[],
  defaultMode: TravelModeOption
): TravelModeOption[] | undefined {
  if (nextSorted.length < 2) return undefined;
  const map = new Map<string, TravelModeOption>();
  if (prevModes && prevSorted.length >= 2) {
    for (let i = 0; i < prevModes.length; i++) {
      const a = prevSorted[i]!.id;
      const b = prevSorted[i + 1]!.id;
      map.set(`${a}\0${b}`, prevModes[i]!);
    }
  }
  const out: TravelModeOption[] = [];
  for (let i = 0; i < nextSorted.length - 1; i++) {
    const a = nextSorted[i]!.id;
    const b = nextSorted[i + 1]!.id;
    out.push(map.get(`${a}\0${b}`) ?? defaultMode);
  }
  return out;
}

export function legTravelModeForLegIndex(
  day: TripDay,
  legIndex: number,
  fallback: TravelModeOption
): TravelModeOption {
  return day.legTravelModes?.[legIndex] ?? fallback;
}
