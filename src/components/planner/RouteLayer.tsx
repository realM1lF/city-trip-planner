"use client";

import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { buildAnchorDepartureDate } from "@/lib/itinerary-time";
import { legTravelModeForLegIndex } from "@/lib/leg-travel-modes";
import {
  buildGoogleMapsDirectionsUrlForStops,
  toGoogleTravelMode,
  travelModeOptionToDirParam,
} from "@/lib/maps-helpers";
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
      return "#111111";
    case "TRANSIT":
      return "#1967d2";
    case "DRIVING":
      return "#5f6368";
    case "BICYCLING":
      return "#137333";
    default:
      return "#111111";
  }
}

/**
 * Fußweg als Punktkette: volle stroke + Dash-Symbole wirkte wie eine durchgehende schwarze Linie.
 * Basislinie bei „gepunktet“ ausblenden, nur Kreise entlang dem Pfad.
 */
function dashedPolylineIcons(lineColor: string): google.maps.IconSequence[] {
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

function stepHasTransitVehicle(step: google.maps.DirectionsStep): boolean {
  return !!(step.transit ?? step.transit_details);
}

function isWalkingStep(step: google.maps.DirectionsStep): boolean {
  if (stepHasTransitVehicle(step)) return false;
  if (step.travel_mode === google.maps.TravelMode.WALKING) return true;
  if (step.travel_mode === google.maps.TravelMode.TRANSIT) return false;
  return true;
}

function styleForTransitStep(step: google.maps.DirectionsStep): {
  color: string;
  dashed: boolean;
} {
  const walk = isWalkingStep(step);
  return {
    color: walk
      ? strokeColorForTravelMode("WALKING")
      : strokeColorForTravelMode("TRANSIT"),
    dashed: walk,
  };
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
  const routeGenerationRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routeHitPolyRef = useRef<google.maps.Polyline | null>(null);
  const routeHitListenerRef = useRef<google.maps.MapsEventListener | null>(
    null
  );
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

  function clearRouteInteractionOverlays() {
    routeHitListenerRef.current?.remove();
    routeHitListenerRef.current = null;
    routeHitPolyRef.current?.setMap(null);
    routeHitPolyRef.current = null;
    routeInfoWindowRef.current?.close();
    routeInfoWindowRef.current = null;
  }

  function clearLegPolylines() {
    for (const p of legPolylinesRef.current) p.setMap(null);
    legPolylinesRef.current = [];
  }

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("click", () => {
      routeInfoWindowRef.current?.close();
    });
    return () => listener.remove();
  }, [map]);

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

      const nLegs = sortedStops.length - 1;
      const legModes = Array.from({ length: nLegs }, (_, i) =>
        legTravelModeForLegIndex(activeDay, i, travelMode)
      );

      const generation = ++routeGenerationRef.current;

      void (async () => {
        clearRouteInteractionOverlays();
        clearLegPolylines();

        const parts: LegRoutePart[] = [];

        for (let i = 0; i < nLegs; i++) {
          if (generation !== routeGenerationRef.current) return;
          const from = sortedStops[i]!;
          const to = sortedStops[i + 1]!;
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

        let combinedPath: google.maps.LatLng[] = [];

        if (map) {
          let zStride = 0;
          for (let legIdx = 0; legIdx < parts.length; legIdx++) {
            const p = parts[legIdx]!;
            const dmLeg = p.directionsLeg;

            const pushSegmentToCombined = (segmentPath: google.maps.LatLng[]) => {
              if (segmentPath.length === 0) return;
              combinedPath =
                combinedPath.length > 0
                  ? combinedPath.concat(segmentPath.slice(1))
                  : [...segmentPath];
            };

            const addVisiblePolyline = (
              segmentPath: google.maps.LatLng[],
              color: string,
              dashed: boolean,
              zIndex: number
            ) => {
              if (segmentPath.length === 0) return;
              pushSegmentToCombined(segmentPath);
              legPolylinesRef.current.push(
                new google.maps.Polyline({
                  path: segmentPath,
                  strokeColor: color,
                  strokeOpacity: dashed ? 0 : 0.92,
                  strokeWeight: dashed ? 0 : 5,
                  clickable: false,
                  zIndex,
                  icons: dashed ? dashedPolylineIcons(color) : undefined,
                  map,
                })
              );
            };

            if (p.mode === "TRANSIT" && dmLeg?.steps && dmLeg.steps.length > 0) {
              let si = 0;
              let drewFromSteps = false;
              forEachLeafStep(dmLeg.steps, (step) => {
                const segmentPath = decodeStepPath(step, geometryLib);
                if (segmentPath.length === 0) return;
                drewFromSteps = true;
                const { color, dashed } = styleForTransitStep(step);
                addVisiblePolyline(segmentPath, color, dashed, 2 + zStride + si);
                si += 1;
              });
              if (!drewFromSteps && p.path.length > 0) {
                addVisiblePolyline(
                  p.path,
                  strokeColorForTravelMode("TRANSIT"),
                  false,
                  2 + zStride
                );
              }
            } else if (p.path.length > 0) {
              const dashed = p.mode === "WALKING";
              addVisiblePolyline(
                p.path,
                strokeColorForTravelMode(p.mode),
                dashed,
                2 + zStride
              );
            }

            zStride += 50;
          }
        }

        if (combinedPath.length > 0 && map) {
          const hitPoly = new google.maps.Polyline({
            path: combinedPath,
            strokeOpacity: 0,
            strokeWeight: 22,
            clickable: true,
            zIndex: 50,
            map,
          });
          routeHitPolyRef.current = hitPoly;

          const iw = new google.maps.InfoWindow();
          routeInfoWindowRef.current = iw;

          const stopPoints = sortedStops.map((s) => ({
            lat: s.lat,
            lng: s.lng,
          }));
          const defaultDirMode = travelModeOptionToDirParam(travelMode);
          const mapsFullUrl =
            buildGoogleMapsDirectionsUrlForStops(stopPoints, defaultDirMode) ??
            "#";

          routeHitListenerRef.current = hitPoly.addListener(
            "click",
            (e: google.maps.MapMouseEvent) => {
              e.stop?.();
              const legItems = parts
                .map((p, i) => {
                  const dm = p.directionsLeg;
                  const from =
                    sortedStops[i]?.label ?? `Stopp ${i + 1}`;
                  const to =
                    sortedStops[i + 1]?.label ?? `Stopp ${i + 2}`;
                  const dur =
                    dm?.duration?.text ??
                    (dm?.duration?.value != null
                      ? `ca. ${Math.ceil(dm.duration.value / 60)} Min.`
                      : "—");
                  const legUrl = buildGoogleMapsDirectionsUrlForStops(
                    [
                      {
                        lat: sortedStops[i]!.lat,
                        lng: sortedStops[i]!.lng,
                      },
                      {
                        lat: sortedStops[i + 1]!.lat,
                        lng: sortedStops[i + 1]!.lng,
                      },
                    ],
                    travelModeOptionToDirParam(p.mode)
                  );
                  const link =
                    legUrl != null
                      ? `<a href="${legUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(dur)} · Maps</a>`
                      : escapeHtml(dur);
                  const modeL = travelModeLabelDe(p.mode);
                  return `<li class="map-route-leg"><strong>${escapeHtml(from)} → ${escapeHtml(to)}</strong> <span class="map-iw-muted">(${escapeHtml(modeL)})</span><br/><span class="map-iw-muted">${link}</span></li>`;
                })
                .join("");

              const html = `<div class="map-infowindow-root map-route-summary"><h3 class="map-infowindow-header">Tagesroute</h3><ul class="map-route-leg-list">${legItems}</ul><p class="map-iw-muted map-route-hint">Punkte entlang der Linie = zu Fuß · durchgezogen blau = Bus/Bahn · Auto grau · Fahrrad grün.</p><p><a href="${mapsFullUrl}" target="_blank" rel="noopener noreferrer">Alle Stopps in Google Maps</a></p></div>`;

              iw.setContent(html);
              const pos = e.latLng ?? combinedPath[0];
              if (pos) iw.setPosition(pos);
              iw.open({ map });
            }
          );
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
