"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useMemo } from "react";
import {
  computeDayItinerary,
  formatTimeWindow,
} from "@/lib/itinerary-time";
import { legTravelModeForLegIndex } from "@/lib/leg-travel-modes";
import { buildGoogleMapsDirectionsUrl } from "@/lib/maps-helpers";
import { useTripStore } from "@/stores/tripStore";
import type { TravelModeOption, TripDay } from "@/types/trip";

type Props = { day: TripDay };

const TRAVEL_MODE_LABEL: Record<TravelModeOption, string> = {
  WALKING: "Zu Fuß",
  DRIVING: "Auto",
  BICYCLING: "Fahrrad",
  TRANSIT: "ÖPNV",
};

function formatCompareMinutes(seconds: number | null): string {
  if (seconds === null) return "—";
  return `${Math.max(1, Math.ceil(seconds / 60))}`;
}

export function DayTimeline({ day }: Props) {
  const legSeconds = useTripStore((s) => s.routeLegDurationsByDayId[day.id]);
  const multiMode = useTripStore((s) => s.multiModeLegSecondsByDayId[day.id]);
  const travelMode = useTripStore((s) => s.travelMode);

  const sorted = useMemo(
    () => [...day.stops].sort((a, b) => a.order - b.order),
    [day.stops]
  );

  const computed = useMemo(
    () => computeDayItinerary(sorted, legSeconds ?? undefined),
    [sorted, legSeconds]
  );

  if (sorted.length === 0) {
    return null;
  }

  if (!day.date) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 px-3 py-2 text-muted-foreground text-xs leading-relaxed">
        Bitte ein <strong>Datum</strong> für diesen Tag setzen. Die Uhrzeiten
        beziehen sich dann auf diesen Kalendertag (wichtig für Verkehr /
        ÖPNV-Vorschläge).
      </div>
    );
  }

  if (!computed.ok) {
    if (computed.reason === "no_legs") {
      return (
        <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-800 text-xs leading-relaxed dark:text-amber-200">
          Mindestens zwei Stopps: Wir brauchen eine berechnete <strong>Route</strong>, um
          Fahrzeiten zu schätzen. Kurz warten oder Reihenfolge der Punkte prüfen.
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 px-3 py-2 text-muted-foreground text-xs leading-relaxed">
        Beim <strong>ersten Stopp</strong> eine <strong>Ankunftszeit</strong>{" "}
        eintragen. Weitere Ankünfte aus der Route; Abreise pro Stopp oder
        geschätzte Verweildauer, dann Zeitfenster im Plan.
      </div>
    );
  }

  const { stops, legs } = computed.itinerary;
  const multiLoading =
    sorted.length >= 2 && legSeconds && legSeconds.length === sorted.length - 1
      ? multiMode === null
      : false;

  return (
    <div className="space-y-3">
      <div className="font-medium text-foreground text-sm">Tageszeitplan</div>
      <ul className="space-y-3 text-sm">
        {stops.map((row, idx) => {
          const stop = sorted[idx];
          if (!stop) return null;
          const leg = idx < legs.length ? legs[idx] : null;
          const nextStop = idx + 1 < sorted.length ? sorted[idx + 1] : null;

          return (
            <li key={row.stopId} className="border-border border-l-2 pl-3">
              <div>
                <span className="font-medium tabular-nums">
                  {formatTimeWindow(row.arrivalTotalMin, row.departureTotalMin)}
                </span>{" "}
                <span className="text-foreground">{stop.label}</span>
              </div>
              <div className="text-muted-foreground text-xs">
                {stop.formattedAddress}
              </div>
              {leg && nextStop ? (
                <div className="mt-1.5 space-y-1.5 text-muted-foreground text-xs">
                  <div>
                    ↓ Fahrt ca. {leg.travelMinutes} Min. (Teilstrecke:{" "}
                    {
                      TRAVEL_MODE_LABEL[
                        legTravelModeForLegIndex(day, idx, travelMode)
                      ]
                    }
                    )
                  </div>
                  {multiLoading ? (
                    <div className="text-muted-foreground/80 italic">
                      Vergleich (Fuß / Auto / ÖPNV) wird berechnet …
                    </div>
                  ) : multiMode &&
                    multiMode.walking.length > idx ? (
                    <div className="space-y-1 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
                      <div className="font-medium text-foreground">
                        Ungefähre Reisezeit dieser Teilstrecke
                      </div>
                      <div className="tabular-nums">
                        Zu Fuß ca. {formatCompareMinutes(multiMode.walking[idx]!)} Min. · Auto
                        ca. {formatCompareMinutes(multiMode.driving[idx]!)} Min. · ÖPNV ca.{" "}
                        {formatCompareMinutes(multiMode.transit[idx]!)} Min.
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
                        <a
                          className="inline-flex items-center gap-0.5 text-primary underline-offset-4 hover:underline"
                          href={buildGoogleMapsDirectionsUrl({
                            origin: { lat: stop.lat, lng: stop.lng },
                            destination: { lat: nextStop.lat, lng: nextStop.lng },
                            travelmode: "walking",
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Maps zu Fuß
                          <ExternalLinkIcon className="size-3 shrink-0 opacity-70" />
                        </a>
                        <a
                          className="inline-flex items-center gap-0.5 text-primary underline-offset-4 hover:underline"
                          href={buildGoogleMapsDirectionsUrl({
                            origin: { lat: stop.lat, lng: stop.lng },
                            destination: { lat: nextStop.lat, lng: nextStop.lng },
                            travelmode: "driving",
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Maps Auto
                          <ExternalLinkIcon className="size-3 shrink-0 opacity-70" />
                        </a>
                        <a
                          className="inline-flex items-center gap-0.5 text-primary underline-offset-4 hover:underline"
                          href={buildGoogleMapsDirectionsUrl({
                            origin: { lat: stop.lat, lng: stop.lng },
                            destination: { lat: nextStop.lat, lng: nextStop.lng },
                            travelmode: "transit",
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Maps ÖPNV
                          <ExternalLinkIcon className="size-3 shrink-0 opacity-70" />
                        </a>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
