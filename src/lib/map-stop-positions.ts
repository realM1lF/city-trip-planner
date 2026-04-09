import { implicitReturnFinalStop } from "@/lib/leg-travel-modes";
import type { TripDay, TripStop } from "@/types/trip";

const EARTH_RADIUS_M = 6_371_000;

/** Max. Abstand (m), ab dem zwei Stopps als unterschiedliche Kartenpunkte gelten. */
export const STOP_LOCATION_DEDUP_THRESHOLD_M = 38;

export type StopMapPin = {
  sortedIndex: number;
  stopId: string;
  displayNumber: number;
  position: google.maps.LatLngLiteral;
  variant: "primary" | "secondary";
};

export type ImplicitReturnMapPin = {
  stopId: string;
  displayNumber: number;
  position: google.maps.LatLngLiteral;
};

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLng = (lng2 - lng1) * r;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

function stopsShareMapLocation(a: TripStop, b: TripStop): boolean {
  const pa = a.placeId?.trim();
  const pb = b.placeId?.trim();
  if (pa && pb && pa === pb) return true;
  return (
    haversineMeters(a.lat, a.lng, b.lat, b.lng) <=
    STOP_LOCATION_DEDUP_THRESHOLD_M
  );
}

/** Zielpunkt (lat, lng) um distanceM Meter in bearingRad (0 = Nord) verschieben. */
export function latLngAtOffsetMeters(
  latDeg: number,
  lngDeg: number,
  distanceM: number,
  bearingRad: number
): google.maps.LatLngLiteral {
  const φ1 = (latDeg * Math.PI) / 180;
  const λ1 = (lngDeg * Math.PI) / 180;
  const δ = distanceM / EARTH_RADIUS_M;
  const θ = bearingRad;
  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);
  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * sinδ * cosφ1;
  const x = cosδ - sinφ1 * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);
  return {
    lat: (φ2 * 180) / Math.PI,
    lng: ((((λ2 * 180) / Math.PI + 540) % 360) - 180) as number,
  };
}

function buildLocationClusters(sorted: TripStop[]): number[][] {
  const n = sorted.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i]!);
    return parent[i]!;
  };
  const union = (i: number, j: number) => {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[ri] = rj;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (stopsShareMapLocation(sorted[i]!, sorted[j]!)) {
        union(i, j);
      }
    }
  }

  const buckets = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const arr = buckets.get(r) ?? [];
    arr.push(i);
    buckets.set(r, arr);
  }

  return [...buckets.values()].map((idxs) => idxs.sort((a, b) => a - b));
}

/**
 * Pro Listenindex: Kartenposition und ob Standard- (primary) oder graue Nadel (secondary).
 * Primary = frühester Index in der Koordinaten-Gruppe; exakte Koordinaten dieses Stopps.
 */
export function computeSortedStopPins(sorted: TripStop[]): StopMapPin[] {
  if (sorted.length === 0) return [];
  const clusters = buildLocationClusters(sorted);
  const byIndex = new Map<number, StopMapPin>();

  for (const cluster of clusters) {
    const anchorIdx = cluster[0]!;
    const anchor = sorted[anchorIdx]!;
    const anchorLat = anchor.lat;
    const anchorLng = anchor.lng;
    const n = cluster.length;

    for (let k = 0; k < n; k++) {
      const idx = cluster[k]!;
      const stop = sorted[idx]!;
      const displayNumber = idx + 1;
      if (k === 0) {
        byIndex.set(idx, {
          sortedIndex: idx,
          stopId: stop.id,
          displayNumber,
          position: { lat: stop.lat, lng: stop.lng },
          variant: "primary",
        });
      } else {
        const secondaryRank = k;
        const rankIdx = secondaryRank - 1;
        /** Ost/West absetzen — grauer Pin „neben“ der roten Nadel statt im Kreis (vermeidet Überdeckung mit Karte). */
        const east = rankIdx % 2 === 0;
        const bearing = east ? Math.PI / 2 : (3 * Math.PI) / 2;
        const distanceM = 16 + Math.floor(rankIdx / 2) * 12;
        byIndex.set(idx, {
          sortedIndex: idx,
          stopId: stop.id,
          displayNumber,
          position: latLngAtOffsetMeters(
            anchorLat,
            anchorLng,
            distanceM,
            bearing
          ),
          variant: "secondary",
        });
      }
    }
  }

  return sorted.map((_, i) => byIndex.get(i)!);
}

/**
 * Index des Stops in `sorted`, der zur gleichen Koordinaten-Gruppe gehört
 * (null wenn nicht gefunden).
 */
function clusterContainingIndex(
  sorted: TripStop[],
  stopId: string
): number[] | null {
  const idx = sorted.findIndex((s) => s.id === stopId);
  if (idx < 0) return null;
  const clusters = buildLocationClusters(sorted);
  return clusters.find((c) => c.includes(idx)) ?? null;
}

/**
 * Zusätzlicher Pin für impliziten Rückweg (Nummer n+1), grau, mit Abstand vom Gruppen-Anker.
 */
export function computeImplicitReturnPin(
  sorted: TripStop[],
  day: Pick<TripDay, "implicitReturnToStopId">,
  sortedPins: StopMapPin[]
): ImplicitReturnMapPin | null {
  const target = implicitReturnFinalStop(day, sorted);
  if (!target) return null;

  const cluster = clusterContainingIndex(sorted, target.id);
  if (!cluster) return null;

  const anchorIdx = cluster[0]!;
  const anchorStop = sorted[anchorIdx]!;
  const anchorLat = anchorStop.lat;
  const anchorLng = anchorStop.lng;

  const secondaryCountAlready = cluster.filter((ci) => {
    const p = sortedPins[ci];
    return p?.variant === "secondary";
  }).length;

  const implicitSecondarySlot = secondaryCountAlready;
  const east = implicitSecondarySlot % 2 === 0;
  const bearing = east ? Math.PI / 2 : (3 * Math.PI) / 2;
  const distanceM = 16 + Math.floor(implicitSecondarySlot / 2) * 12;

  return {
    stopId: target.id,
    displayNumber: sorted.length + 1,
    position: latLngAtOffsetMeters(
      anchorLat,
      anchorLng,
      distanceM,
      bearing
    ),
  };
}

/** Tooltip für den grauen „Rückkehr“-Zusatz-Marker (implizite letzte Leg). */
export function implicitReturnVisitMarkerTitle(
  ir: ImplicitReturnMapPin,
  sorted: TripStop[],
  timeByStopId: Record<string, string> | null,
  implicitFinalStopId: string | null,
  implicitHomeArrivalLabel: string | null
): string {
  const tStop = sorted.find((x) => x.id === ir.stopId);
  const tw = tStop && timeByStopId ? timeByStopId[tStop.id] : null;
  let title = `${ir.displayNumber}. ${tStop?.label ?? "Ziel"} · Rückweg (Ankunft)`;
  if (
    tStop?.isAccommodation &&
    implicitFinalStopId === tStop.id &&
    implicitHomeArrivalLabel
  ) {
    title += ` ca. ${implicitHomeArrivalLabel}`;
  }
  if (tw) title += ` · früheres Zeitfenster ${tw}`;
  return title;
}

/** Anzeigegröße auf der Karte (Google `scaledSize` / `anchor`). */
export const SECONDARY_MAP_PIN_DISPLAY = {
  width: 30,
  height: 36,
  anchorX: 15,
  anchorY: 36,
} as const;

/**
 * Google-Marker-zIndex: rote Primär-Nadeln immer über grauen (Zweitbesuch / Rückweg).
 * Leichte Nummer-Abstufung bei Überlagerung gleicher Klasse.
 */
const MAP_MARKER_Z_PRIMARY_BASE = 25_000;
const MAP_MARKER_Z_SECONDARY_BASE = 10_000;

export function primaryMapMarkerZIndex(displayNumber: number): number {
  return MAP_MARKER_Z_PRIMARY_BASE + displayNumber;
}

export function secondaryMapMarkerZIndex(displayNumber: number): number {
  return MAP_MARKER_Z_SECONDARY_BASE + displayNumber;
}

/** SVG-Daten-URL: kompakte graue Nadel mit eingebetteter Nummer. */
export function secondaryMapPinIconDataUrl(displayNumber: number): string {
  const t = String(displayNumber);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="36" viewBox="0 0 30 36"><path fill="#6b7280" stroke="#4b5563" stroke-width="0.85" d="M15 2.2C8.5 2.2 3.2 7.3 3.2 13.4c0 6.7 9 16 11.3 18.2.35.4.9.4 1.25 0C18 29.4 26.8 20.1 26.8 13.4 26.8 7.3 21.5 2.2 15 2.2z"/><circle cx="15" cy="12.5" r="7.2" fill="#f9fafb"/><text x="15" y="12.5" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="700" fill="#111827" font-family="system-ui,sans-serif">${t}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
