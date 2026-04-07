import type { TravelModeOption, TripDay, TripStop } from "@/types/trip";

/** Letzter Stopp → dieses Ziel zeichnen, ohne neuen Stopp (nur wenn Ziel ≠ letzter Stopp). */
export function getValidImplicitReturnTarget(
  day: Pick<TripDay, "implicitReturnToStopId">,
  sortedStops: TripStop[]
): TripStop | null {
  const tid = day.implicitReturnToStopId?.trim();
  if (!tid || sortedStops.length < 2) return null;
  const target = sortedStops.find((s) => s.id === tid);
  const last = sortedStops[sortedStops.length - 1]!;
  if (!target || last.id === target.id) return null;
  return target;
}

/** Anzahl Hauptroute-Legs inkl. optionaler Rück-Teilstrecke. */
export function expectedRouteLegCount(
  day: Pick<TripDay, "implicitReturnToStopId">,
  sortedStops: TripStop[]
): number {
  if (sortedStops.length < 2) return 0;
  return (
    sortedStops.length -
    1 +
    (getValidImplicitReturnTarget(day, sortedStops) ? 1 : 0)
  );
}

/**
 * Nach Änderung der Stopp-Liste: Basis-Legs mappen, impliziten Rückweg + Extra-Modus beibehalten falls weiter gültig.
 */
export function reconcileDayLegTravelModesAfterStopsChange(
  prevDay: TripDay,
  prevSorted: TripStop[],
  nextStops: TripStop[],
  defaultMode: TravelModeOption
): Pick<TripDay, "legTravelModes" | "implicitReturnToStopId"> {
  const sorted = [...nextStops].sort((a, b) => a.order - b.order);
  if (sorted.length < 2) {
    return { legTravelModes: undefined, implicitReturnToStopId: null };
  }

  let implicitReturnToStopId = prevDay.implicitReturnToStopId ?? null;
  if (implicitReturnToStopId && !sorted.some((s) => s.id === implicitReturnToStopId)) {
    implicitReturnToStopId = null;
  }

  const baseModes = remapLegTravelModesAfterStopsChange(
    prevSorted,
    prevDay.legTravelModes,
    sorted,
    defaultMode
  );

  const target = implicitReturnToStopId
    ? sorted.find((s) => s.id === implicitReturnToStopId)
    : null;
  const last = sorted[sorted.length - 1]!;

  if (!target || last.id === target.id) {
    implicitReturnToStopId = null;
    return { legTravelModes: baseModes, implicitReturnToStopId };
  }

  const baseLen = sorted.length - 1;
  const modes = [...(baseModes ?? [])];
  while (modes.length < baseLen) {
    modes.push(defaultMode);
  }
  const trimmed = modes.slice(0, baseLen);

  const prevHadImplicitExtra =
    (prevDay.legTravelModes?.length ?? 0) >
    Math.max(0, prevSorted.length - 1);
  const extraMode = prevHadImplicitExtra
    ? prevDay.legTravelModes![prevDay.legTravelModes!.length - 1]!
    : defaultMode;

  trimmed.push(extraMode);
  return {
    legTravelModes: trimmed,
    implicitReturnToStopId,
  };
}

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
    const maxBase = prevSorted.length - 1;
    /* Nur offene Stopps-Paare; Eintrag [length] gehört ggf. zum impliziten Rückweg. */
    for (let i = 0; i < prevModes.length && i < maxBase; i++) {
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
  fallback: TravelModeOption,
  sortedStops?: TripStop[]
): TravelModeOption {
  if (sortedStops && sortedStops.length >= 2) {
    const implicit = getValidImplicitReturnTarget(day, sortedStops);
    const baseLegs = sortedStops.length - 1;
    const totalLegs = baseLegs + (implicit ? 1 : 0);
    if (legIndex < 0 || legIndex >= totalLegs) {
      return fallback;
    }
  }
  return day.legTravelModes?.[legIndex] ?? fallback;
}
