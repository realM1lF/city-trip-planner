"use client";

import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useRef } from "react";
import { anchorHHmmForFirstStopDirections } from "@/lib/itinerary-time";
import { directionsAnchorDepartureFromPlanDay } from "@/lib/itinerary-live";
import { getValidImplicitReturnTarget } from "@/lib/leg-travel-modes";
import { useTripStore } from "@/stores/tripStore";
import type { MultiModeLegSeconds } from "@/types/trip";

const DEBOUNCE_MS = 900;
const BETWEEN_LEGS_MS = 120;

function legDurationSeconds(
  svc: google.maps.DirectionsService,
  request: google.maps.DirectionsRequest
): Promise<number | null> {
  return new Promise((resolve) => {
    svc.route(request, (result, status) => {
      if (status !== "OK" || !result?.routes[0]) {
        resolve(null);
        return;
      }
      const leg = result.routes[0]?.legs?.[0];
      const sec = leg?.duration?.value;
      resolve(typeof sec === "number" ? sec : null);
    });
  });
}

/**
 * Berechnet je Teilstrecke Fuß / Auto / ÖPNV (gedrosselt, nach der Hauptroute).
 */
export function MultiModeLegsLayer({
  readOnly = false,
}: { readOnly?: boolean } = {}) {
  const routesLib = useMapsLibrary("routes");
  const activeDayId = useTripStore((s) => s.activeDayId);
  const trip = useTripStore((s) => s.trip);
  const setMultiModeLegSeconds = useTripStore(
    (s) => s.setMultiModeLegSeconds
  );

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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchGenerationRef = useRef(0);

  useEffect(() => {
    if (readOnly || !routesLib) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (sortedStops.length < 2) {
        setMultiModeLegSeconds(activeDayId, null);
        return;
      }

      const svc = new routesLib.DirectionsService();
      const anchorDeparture = directionsAnchorDepartureFromPlanDay(
        activeDay?.date ?? null,
        anchorHHmmForFirstStopDirections(sortedStops[0])
      );
      const transitDeparture = anchorDeparture ?? new Date();

      const generation = ++fetchGenerationRef.current;
      setMultiModeLegSeconds(activeDayId, null);

      const run = async () => {
        const n = sortedStops.length - 1;
        const walking: (number | null)[] = [];
        const driving: (number | null)[] = [];
        const transit: (number | null)[] = [];

        const implicitTarget = activeDay
          ? getValidImplicitReturnTarget(activeDay, sortedStops)
          : null;
        const totalLegs = n + (implicitTarget ? 1 : 0);

        for (let i = 0; i < totalLegs; i++) {
          if (generation !== fetchGenerationRef.current) return;
          const from = sortedStops[i]!;
          const to =
            i < n
              ? sortedStops[i + 1]!
              : implicitTarget!;
          const origin = { lat: from.lat, lng: from.lng };
          const destination = { lat: to.lat, lng: to.lng };

          const base: google.maps.DirectionsRequest = {
            origin,
            destination,
            travelMode: google.maps.TravelMode.WALKING,
          };

          const w = await legDurationSeconds(svc, {
            ...base,
            travelMode: google.maps.TravelMode.WALKING,
          });
          walking.push(w);

          const dReq: google.maps.DirectionsRequest = {
            ...base,
            travelMode: google.maps.TravelMode.DRIVING,
          };
          if (anchorDeparture) {
            dReq.drivingOptions = { departureTime: anchorDeparture };
          }
          const d = await legDurationSeconds(svc, dReq);
          driving.push(d);

          const t = await legDurationSeconds(svc, {
            ...base,
            travelMode: google.maps.TravelMode.TRANSIT,
            transitOptions: { departureTime: transitDeparture },
          });
          transit.push(t);

          if (i < totalLegs - 1) {
            await new Promise((r) => setTimeout(r, BETWEEN_LEGS_MS));
          }
        }

        if (generation === fetchGenerationRef.current) {
          const payload: MultiModeLegSeconds = { walking, driving, transit };
          setMultiModeLegSeconds(activeDayId, payload);
        }
      };

      void run();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    readOnly,
    routesLib,
    sortedStops,
    activeDayId,
    activeDay?.implicitReturnToStopId,
    setMultiModeLegSeconds,
  ]);

  return null;
}
