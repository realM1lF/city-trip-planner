import type { TripStop } from "@/types/trip";

/** Payload wie von PlaceAutocomplete / Stop-Einfügen, für Duplikat-Prüfung */
export type AutocompletePlacePick = {
  placeId?: string;
  formattedAddress: string;
  lat: number;
  lng: number;
};

export function normalizeFormattedAddress(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function isSameAddress(stop: TripStop, pick: AutocompletePlacePick): boolean {
  const pPid = pick.placeId?.trim();
  const sPid = stop.placeId?.trim();

  if (pPid && sPid && pPid === sPid) {
    return true;
  }

  const pAddr = normalizeFormattedAddress(pick.formattedAddress);
  const sAddr = normalizeFormattedAddress(stop.formattedAddress);
  if (pAddr.length === 0 || sAddr.length === 0) {
    return false;
  }
  return pAddr === sAddr;
}

/**
 * Erster Treffer in der bereits sortierten Stopp-Liste (aufsteigend `order`).
 * `displayIndex` = 1-basierte Position für UI („Stopp 3“).
 */
export function findFirstDuplicateStop(
  sortedStops: TripStop[],
  pick: AutocompletePlacePick
): { stop: TripStop; displayIndex: number } | null {
  for (let i = 0; i < sortedStops.length; i++) {
    const s = sortedStops[i]!;
    if (isSameAddress(s, pick)) {
      return { stop: s, displayIndex: i + 1 };
    }
  }
  return null;
}
