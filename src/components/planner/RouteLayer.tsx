"use client";

import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { buildAnchorDepartureDate } from "@/lib/itinerary-time";
import {
  expectedRouteLegCount,
  getValidImplicitReturnTarget,
  legTravelModeForLegIndex,
} from "@/lib/leg-travel-modes";
import {
  buildGoogleMapsDirectionsUrlForStops,
  toGoogleTravelMode,
  travelModeOptionToDirParam,
} from "@/lib/maps-helpers";
import { subscribeMapBackgroundClick } from "@/lib/route-map-ui-bridge";
import { useTripStore } from "@/stores/tripStore";
import type { TravelModeOption, Trip } from "@/types/trip";

export type RouteLayerSnapshot = {
  activeDayId: string;
  trip: Trip;
  travelMode: TravelModeOption;
};

const DEFAULT_DEBOUNCE_MS = 450;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ROUTE_WALK_BLUE = "#1a73e8";
const ROUTE_DRIVE_ORANGE = "#ea580c";
const ROUTE_TRANSIT_GREEN = "#16a34a";
const ROUTE_BIKE_GREEN = "#65a30d";

function travelModeLabelDe(mode: TravelModeOption): string {
  switch (mode) {
    case "DRIVING":
      return "Auto";
    case "BICYCLING":
      return "Fahrrad";
    case "TRANSIT":
      return "ÖPNV";
    case "WALKING":
    default:
      return "Zu Fuß";
  }
}

function strokeColorForTravelMode(mode: TravelModeOption): string {
  switch (mode) {
    case "WALKING":
      return ROUTE_WALK_BLUE;
    case "DRIVING":
      return ROUTE_DRIVE_ORANGE;
    case "TRANSIT":
      return ROUTE_TRANSIT_GREEN;
    case "BICYCLING":
      return ROUTE_BIKE_GREEN;
    default:
      return ROUTE_WALK_BLUE;
  }
}

/** Material Icons (24px) Pfad — nur `d`, viewBox 0 0 24 24 */
const MODE_ICON_PATH_D: Record<TravelModeOption, string> = {
  WALKING:
    "M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-9 2.1 2v6h2v-7.5l-2.1-2 .6-3H15V9H9.8z",
  DRIVING:
    "M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.26 3.72H5.59l1.26-3.72zM6 17c-.83 0-1.5-.67-1.5-1.5S5.17 14 6 14s1.5.67 1.5 1.5S6.83 17 6 17zm12 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z",
  TRANSIT:
    "M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-1.5-5-5-5H9C5.5 1 4 2.5 4 6v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z",
  BICYCLING:
    "M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 4.9 2.1v-2c-1.5 0-2.7-.6-3.6-1.5L9.1 7.1c-.5-.4-1.2-.6-1.9-.6-.6 0-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4l2.4 2.4V19h2v-6.2l2.2-2.4zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z",
};

function midpointAlongPolyline(path: google.maps.LatLng[]): google.maps.LatLng | null {
  if (path.length === 0) return null;
  if (path.length === 1) return path[0]!;
  const spherical = google.maps.geometry?.spherical;
  if (!spherical) {
    return path[Math.floor((path.length - 1) / 2)]!;
  }
  let total = 0;
  const segLens: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const d = spherical.computeDistanceBetween(path[i]!, path[i + 1]!);
    segLens.push(d);
    total += d;
  }
  if (total <= 0) {
    return path[Math.floor(path.length / 2)]!;
  }
  let remaining = total / 2;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = segLens[i]!;
    if (remaining <= seg) {
      const t = seg <= 0 ? 0 : remaining / seg;
      return spherical.interpolate(path[i]!, path[i + 1]!, t);
    }
    remaining -= seg;
  }
  return path[path.length - 1]!;
}

/** 24×24-Icon exakt in die Kreismitte (cx,cy); S skaliert ins Weiß hinein (~20px Kante bei S≈0,85). */
const PIN_ICON_CENTER_X = 22;
const PIN_ICON_CENTER_Y = 19;
const PIN_ICON_VIEWBOX_HALF = 12;
const PIN_ICON_SCALE = 0.88;

function legModePinIconDataUrl(mode: TravelModeOption): string {
  const c = strokeColorForTravelMode(mode);
  const d = MODE_ICON_PATH_D[mode];
  const t = `translate(${PIN_ICON_CENTER_X} ${PIN_ICON_CENTER_Y}) scale(${PIN_ICON_SCALE}) translate(-${PIN_ICON_VIEWBOX_HALF} -${PIN_ICON_VIEWBOX_HALF})`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52"><path fill="${c}" d="M22 3C12.6 3 5 10.6 5 20c0 9.2 14.5 24.2 17 26.5.5.4 1.2.4 1.7 0C26.5 44.2 39 29.2 39 20 39 10.6 31.4 3 22 3z"/><circle cx="${PIN_ICON_CENTER_X}" cy="${PIN_ICON_CENTER_Y}" r="12.5" fill="#fff"/><g transform="${t}" fill="${c}"><path d="${d}"/></g></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

type RouteLineVariant = "solid" | "dotted" | "striped";

/**
 * Fußweg als Punktkette: volle stroke + Dash-Symbole wirkte wie eine durchgehende schwarze Linie.
 * Basislinie bei „gepunktet“ ausblenden, nur Kreise entlang dem Pfad.
 */
function dottedPolylineIcons(lineColor: string): google.maps.IconSequence[] {
  return [
    {
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: lineColor,
        fillOpacity: 1,
        strokeOpacity: 0,
        scale: 3,
      },
      offset: "0",
      repeat: "11px",
    },
  ];
}

/** Striche entlang der Route (lokal x = Laufrichtung). */
function stripedPolylineIcons(lineColor: string): google.maps.IconSequence[] {
  return [
    {
      icon: {
        path: "M -0.6,0 0.6,0",
        strokeColor: lineColor,
        strokeOpacity: 1,
        strokeWeight: 3,
        scale: 4,
      },
      offset: "0",
      repeat: "16px",
    },
  ];
}

function stepHasTransitVehicle(step: google.maps.DirectionsStep): boolean {
  return !!(step.transit ?? step.transit_details);
}

function isWalkingStep(step: google.maps.DirectionsStep): boolean {
  if (stepHasTransitVehicle(step)) return false;
  if (step.travel_mode === google.maps.TravelMode.WALKING) return true;
  if (step.travel_mode === google.maps.TravelMode.TRANSIT) return false;
  /* Ohne expliziten Fußweg: in ÖPNV-Antworten eher Bahn/Bus als Spaziergang */
  return false;
}

function styleForTransitStep(step: google.maps.DirectionsStep): {
  variant: RouteLineVariant;
  color: string;
} {
  const walk = isWalkingStep(step);
  return walk
    ? { variant: "dotted", color: ROUTE_WALK_BLUE }
    : { variant: "solid", color: ROUTE_TRANSIT_GREEN };
}

/** Google liefert bei ÖPNV oft nur encoded_lat_lngs, path bleibt leer. */
function decodeStepPath(
  step: google.maps.DirectionsStep,
  geometryLib: google.maps.GeometryLibrary | null
): google.maps.LatLng[] {
  if (step.path?.length) {
    return [...step.path];
  }
  const enc =
    typeof step.encoded_lat_lngs === "string"
      ? step.encoded_lat_lngs.trim()
      : "";
  if (enc && geometryLib && typeof google !== "undefined") {
    return google.maps.geometry.encoding.decodePath(enc);
  }
  const pts = step.polyline?.points?.trim();
  if (pts && geometryLib && typeof google !== "undefined") {
    return google.maps.geometry.encoding.decodePath(pts);
  }
  if (step.lat_lngs?.length) {
    return [...step.lat_lngs];
  }
  return [];
}

function forEachLeafStep(
  steps: google.maps.DirectionsStep[] | undefined,
  fn: (step: google.maps.DirectionsStep) => void
): void {
  if (!steps?.length) return;
  for (const s of steps) {
    if (s.steps?.length) {
      forEachLeafStep(s.steps, fn);
    } else {
      fn(s);
    }
  }
}

type LegRoutePart = {
  path: google.maps.LatLng[];
  seconds: number;
  mode: TravelModeOption;
  directionsLeg: google.maps.DirectionsLeg | null;
};

const LEG_MODE_PICK_ORDER: TravelModeOption[] = [
  "WALKING",
  "DRIVING",
  "TRANSIT",
  "BICYCLING",
];

function createLegRouteInfoContent(opts: {
  readOnly: boolean;
  fromLabel: string;
  toLabel: string;
  origin: google.maps.LatLngLiteral;
  destination: google.maps.LatLngLiteral;
  part: LegRoutePart;
  onPickMode?: (mode: TravelModeOption) => void;
}): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "map-infowindow-root map-route-leg-picker";

  const h = document.createElement("h3");
  h.className = "map-infowindow-header";
  h.textContent = "Teilstrecke";

  const routeLine = document.createElement("p");
  routeLine.className = "map-iw-muted";
  routeLine.style.marginTop = "4px";
  routeLine.innerHTML = `<strong>${escapeHtml(opts.fromLabel)}</strong> → <strong>${escapeHtml(opts.toLabel)}</strong>`;

  const dm = opts.part.directionsLeg;
  const durText =
    dm?.duration?.text ??
    (dm?.duration?.value != null
      ? `ca. ${Math.ceil(dm.duration.value / 60)} Min.`
      : "—");
  const durEl = document.createElement("p");
  durEl.className = "map-iw-muted";
  durEl.style.marginTop = "4px";
  durEl.textContent = `${durText} · ${travelModeLabelDe(opts.part.mode)}`;

  wrap.appendChild(h);
  wrap.appendChild(routeLine);
  wrap.appendChild(durEl);

  const legUrl = buildGoogleMapsDirectionsUrlForStops(
    [opts.origin, opts.destination],
    travelModeOptionToDirParam(opts.part.mode)
  );
  if (legUrl) {
    const a = document.createElement("a");
    a.href = legUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "map-iw-place-link";
    a.textContent = "In Google Maps öffnen";
    wrap.appendChild(a);
  }

  if (!opts.readOnly && opts.onPickMode) {
    const hint = document.createElement("p");
    hint.className = "map-iw-muted";
    hint.style.marginTop = "10px";
    hint.style.fontSize = "11px";
    hint.textContent = "Verkehrsmittel für dieses Teilstück:";
    wrap.appendChild(hint);

    const row = document.createElement("div");
    row.className = "map-route-mode-row";
    for (const mode of LEG_MODE_PICK_ORDER) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "map-route-mode-btn";
      b.textContent = travelModeLabelDe(mode);
      if (opts.part.mode === mode) b.classList.add("is-active");
      b.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        opts.onPickMode?.(mode);
      });
      row.appendChild(b);
    }
    wrap.appendChild(row);
  }

  return wrap;
}

/** Pro Teilstrecke eigene Directions + farbige Polyline (gemischte Modi). */
export function RouteLayer({
  readOnly = false,
  snapshot,
}: {
  readOnly?: boolean;
  snapshot?: RouteLayerSnapshot;
} = {}) {
  const map = useMap();
  const routesLib = useMapsLibrary("routes");
  const geometryLib = useMapsLibrary("geometry");
  const storeActiveDayId = useTripStore((s) => s.activeDayId);
  const storeTrip = useTripStore((s) => s.trip);
  const storeTravelMode = useTripStore((s) => s.travelMode);
  const setLegDurations = useTripStore((s) => s.setLegDurations);

  const activeDayId = snapshot?.activeDayId ?? storeActiveDayId;
  const trip = snapshot?.trip ?? storeTrip;
  const travelMode = snapshot?.travelMode ?? storeTravelMode;
  const persistLegDurations: typeof setLegDurations = readOnly
    ? () => {}
    : setLegDurations;

  const legPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const legModeMarkersRef = useRef<google.maps.Marker[]>([]);
  const routeGenerationRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routeLegHitPolysRef = useRef<google.maps.Polyline[]>([]);
  const routeHighlightPolyRef = useRef<google.maps.Polyline | null>(null);
  const routeInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const activeDay = useMemo(
    () => trip.days.find((d) => d.id === activeDayId),
    [trip.days, activeDayId]
  );

  const sortedStops = useMemo(
    () =>
      activeDay
        ? [...activeDay.stops].sort((a, b) => a.order - b.order)
        : [],
    [activeDay]
  );

  const clearRouteSelectionUi = useCallback(() => {
    routeInfoWindowRef.current?.close();
    routeInfoWindowRef.current = null;
    routeHighlightPolyRef.current?.setMap(null);
    routeHighlightPolyRef.current = null;
  }, []);

  function clearRouteInteractionOverlays() {
    for (const hp of routeLegHitPolysRef.current) {
      hp.setMap(null);
    }
    routeLegHitPolysRef.current = [];
    clearRouteSelectionUi();
  }

  function clearLegPolylines() {
    for (const p of legPolylinesRef.current) p.setMap(null);
    legPolylinesRef.current = [];
    for (const m of legModeMarkersRef.current) m.setMap(null);
    legModeMarkersRef.current = [];
  }

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("click", () => {
      clearRouteSelectionUi();
    });
    return () => listener.remove();
  }, [map, clearRouteSelectionUi]);

  useEffect(() => {
    return subscribeMapBackgroundClick(clearRouteSelectionUi);
  }, [clearRouteSelectionUi]);

  useEffect(() => {
    if (!routesLib || !activeDay) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (sortedStops.length < 2) {
        clearRouteInteractionOverlays();
        clearLegPolylines();
        persistLegDurations(activeDayId, null);
        return;
      }

      const svc = new routesLib.DirectionsService();
      const anchorDeparture = buildAnchorDepartureDate(
        activeDay.date ?? null,
        sortedStops[0]?.arrivalTime
      );

      const nLegs = expectedRouteLegCount(activeDay, sortedStops);
      const legModes = Array.from({ length: nLegs }, (_, i) =>
        legTravelModeForLegIndex(activeDay, i, travelMode, sortedStops)
      );

      const generation = ++routeGenerationRef.current;

      void (async () => {
        clearRouteInteractionOverlays();
        clearLegPolylines();

        const parts: LegRoutePart[] = [];

        for (let i = 0; i < nLegs; i++) {
          if (generation !== routeGenerationRef.current) return;
          const from = sortedStops[i]!;
          const to =
            i < sortedStops.length - 1
              ? sortedStops[i + 1]!
              : getValidImplicitReturnTarget(activeDay, sortedStops)!;
          const mode = legModes[i]!;

          const request: google.maps.DirectionsRequest = {
            origin: { lat: from.lat, lng: from.lng },
            destination: { lat: to.lat, lng: to.lng },
            travelMode: toGoogleTravelMode(mode),
          };

          if (mode === "DRIVING" && anchorDeparture) {
            request.drivingOptions = { departureTime: anchorDeparture };
          }
          if (mode === "TRANSIT" && typeof window !== "undefined") {
            request.transitOptions = {
              departureTime: anchorDeparture ?? new Date(),
            };
          }

          const part = await new Promise<LegRoutePart>((resolve) => {
            svc.route(request, (result, status) => {
              if (status !== "OK" || !result?.routes[0]) {
                resolve({
                  path: [],
                  seconds: 0,
                  mode,
                  directionsLeg: null,
                });
                return;
              }
              const r0 = result.routes[0]!;
              const dmLeg = r0.legs?.[0] ?? null;
              const sec = dmLeg?.duration?.value ?? 0;

              let pathPoints: google.maps.LatLng[] = r0.overview_path?.length
                ? [...r0.overview_path]
                : [];
              if (
                pathPoints.length === 0 &&
                r0.overview_polyline &&
                geometryLib
              ) {
                pathPoints = google.maps.geometry.encoding.decodePath(
                  r0.overview_polyline
                );
              }

              resolve({
                path: pathPoints,
                seconds: sec,
                mode,
                directionsLeg: dmLeg,
              });
            });
          });

          parts.push(part);
        }

        if (generation !== routeGenerationRef.current) return;

        const anyFail = parts.some((p) => p.path.length === 0);
        if (anyFail) {
          persistLegDurations(activeDayId, null);
          toast.warning(
            "Mindestens eine Teilstrecke konnte nicht berechnet werden."
          );
          return;
        }

        if (generation !== routeGenerationRef.current) return;

        const seconds = parts.map((p) => p.seconds);
        persistLegDurations(activeDayId, seconds);

        if (map) {
          let zStride = 0;
          for (let legIdx = 0; legIdx < parts.length; legIdx++) {
            const p = parts[legIdx]!;
            const dmLeg = p.directionsLeg;

            const paintRouteSegment = (
              segmentPath: google.maps.LatLng[],
              color: string,
              variant: RouteLineVariant,
              zIndex: number
            ) => {
              if (segmentPath.length === 0) return;
              if (variant === "dotted") {
                legPolylinesRef.current.push(
                  new google.maps.Polyline({
                    path: segmentPath,
                    strokeColor: color,
                    strokeOpacity: 0,
                    strokeWeight: 0,
                    clickable: false,
                    zIndex,
                    icons: dottedPolylineIcons(color),
                    map,
                  })
                );
              } else if (variant === "striped") {
                legPolylinesRef.current.push(
                  new google.maps.Polyline({
                    path: segmentPath,
                    strokeColor: color,
                    strokeOpacity: 0,
                    strokeWeight: 0,
                    clickable: false,
                    zIndex,
                    icons: stripedPolylineIcons(color),
                    map,
                  })
                );
              } else {
                legPolylinesRef.current.push(
                  new google.maps.Polyline({
                    path: segmentPath,
                    strokeColor: color,
                    strokeOpacity: 0.92,
                    strokeWeight: 5,
                    clickable: false,
                    zIndex,
                    map,
                  })
                );
              }
            };

            const addVisibleRouteSegment = (
              segmentPath: google.maps.LatLng[],
              color: string,
              variant: RouteLineVariant,
              zIndex: number
            ) => {
              if (segmentPath.length === 0) return;
              paintRouteSegment(segmentPath, color, variant, zIndex);
            };

            if (p.mode === "TRANSIT") {
              const zBase = 2 + zStride;
              let si = 0;
              let drewStepVisual = false;
              let drewVehicleSolid = false;

              if (dmLeg?.steps && dmLeg.steps.length > 0) {
                forEachLeafStep(dmLeg.steps, (step) => {
                  const segmentPath = decodeStepPath(step, geometryLib);
                  if (segmentPath.length === 0) return;
                  drewStepVisual = true;
                  const { color, variant } = styleForTransitStep(step);
                  if (variant === "solid") drewVehicleSolid = true;
                  paintRouteSegment(
                    segmentPath,
                    color,
                    variant,
                    zBase + 15 + si
                  );
                  si += 1;
                });
              }

              /* Overview, wenn keine Schritt-Geometrie oder Fahrtsegment nur in overview_path. */
              if (p.path.length > 0 && (!drewStepVisual || !drewVehicleSolid)) {
                paintRouteSegment(
                  p.path,
                  ROUTE_TRANSIT_GREEN,
                  "solid",
                  zBase
                );
              }
            } else if (p.path.length > 0) {
              const variant: RouteLineVariant =
                p.mode === "WALKING"
                  ? "dotted"
                  : p.mode === "BICYCLING"
                    ? "striped"
                    : "solid";
              addVisibleRouteSegment(
                p.path,
                strokeColorForTravelMode(p.mode),
                variant,
                2 + zStride
              );
            }

            if (p.path.length > 0) {
              const hitPoly = new google.maps.Polyline({
                path: p.path,
                strokeOpacity: 0,
                strokeWeight: 28,
                clickable: true,
                zIndex: 52 + legIdx,
                map,
              });
              routeLegHitPolysRef.current.push(hitPoly);

              hitPoly.addListener("click", (e: google.maps.MapMouseEvent) => {
                e.stop?.();

                routeHighlightPolyRef.current?.setMap(null);
                const hiColor = strokeColorForTravelMode(p.mode);
                routeHighlightPolyRef.current = new google.maps.Polyline({
                  path: p.path,
                  strokeColor: hiColor,
                  strokeOpacity: 0.5,
                  strokeWeight: 18,
                  clickable: false,
                  zIndex: 120,
                  map,
                });

                const fromStop = sortedStops[legIdx]!;
                const toStop =
                  legIdx < sortedStops.length - 1
                    ? sortedStops[legIdx + 1]!
                    : getValidImplicitReturnTarget(activeDay, sortedStops)!;
                const partSnapshot = parts[legIdx]!;

                routeInfoWindowRef.current?.close();
                routeInfoWindowRef.current = null;

                const iw = new google.maps.InfoWindow();
                routeInfoWindowRef.current = iw;

                const content = createLegRouteInfoContent({
                  readOnly,
                  fromLabel: fromStop.label ?? `Stopp ${legIdx + 1}`,
                  toLabel: toStop.label ?? `Stopp ${legIdx + 2}`,
                  origin: { lat: fromStop.lat, lng: fromStop.lng },
                  destination: { lat: toStop.lat, lng: toStop.lng },
                  part: partSnapshot,
                  onPickMode: readOnly
                    ? undefined
                    : (mode) => {
                        useTripStore
                          .getState()
                          .setDayLegTravelMode(activeDayId, legIdx, mode);
                        routeInfoWindowRef.current?.close();
                        routeInfoWindowRef.current = null;
                      },
                });

                iw.setContent(content);
                const pos = e.latLng ?? p.path[0];
                if (pos) iw.setPosition(pos);
                iw.open({ map });
              });
            }

            const legMid = midpointAlongPolyline(p.path);
            if (legMid) {
              const mode = p.mode;
              const iconUrl = legModePinIconDataUrl(mode);
              const marker = new google.maps.Marker({
                position: legMid,
                map,
                zIndex: 75,
                clickable: false,
                optimized: true,
                title: travelModeLabelDe(mode),
                icon: {
                  url: iconUrl,
                  scaledSize: new google.maps.Size(44, 52),
                  anchor: new google.maps.Point(22, 52),
                },
              });
              legModeMarkersRef.current.push(marker);
            }

            zStride += 50;
          }
        }
      })();
    }, DEFAULT_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    routesLib,
    sortedStops,
    travelMode,
    activeDayId,
    activeDay,
    activeDay?.implicitReturnToStopId,
    persistLegDurations,
    geometryLib,
    map,
  ]);

  useEffect(() => {
    return () => {
      clearRouteInteractionOverlays();
      clearLegPolylines();
    };
  }, []);

  return null;
}
