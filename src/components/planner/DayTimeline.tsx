"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  Bus,
  Car,
  Clock,
  ExternalLinkIcon,
  Footprints,
  Home,
  MapPin,
  Bike,
} from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  computeDayItinerary,
  formatScheduleMinutes,
  formatTimeWindow,
  implicitReturnArrivalTotalMin,
} from "@/lib/itinerary-time";
import {
  expectedRouteLegCount,
  getValidImplicitReturnTarget,
  implicitReturnFinalStop,
  implicitReturnSegmentStops,
  legTravelModeForLegIndex,
} from "@/lib/leg-travel-modes";
import { buildGoogleMapsDirectionsUrl } from "@/lib/maps-helpers";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/stores/tripStore";
import type {
  MultiModeLegSeconds,
  TravelModeOption,
  TripDay,
} from "@/types/trip";

export type DayTimelinePersistedContext = {
  legSeconds: number[] | null | undefined;
  multiMode: MultiModeLegSeconds | null | undefined;
  travelMode: TravelModeOption;
};

type Props = {
  day: TripDay;
  /** Z. B. Share-Ansicht: Werte aus Persistenz statt Live-Store. */
  persistedContext?: DayTimelinePersistedContext;
};

const MODE_META: Record<
  TravelModeOption,
  { label: string; Icon: LucideIcon; ring: string; iconClass: string }
> = {
  WALKING: {
    label: "Zu Fuß",
    Icon: Footprints,
    ring: "ring-blue-500/25 bg-blue-500/10",
    iconClass: "text-[#1a73e8]",
  },
  DRIVING: {
    label: "Auto",
    Icon: Car,
    ring: "ring-orange-500/25 bg-orange-500/10",
    iconClass: "text-[#ea580c]",
  },
  TRANSIT: {
    label: "ÖPNV",
    Icon: Bus,
    ring: "ring-planner-transit/25 bg-planner-transit/10",
    iconClass: "text-planner-transit",
  },
  BICYCLING: {
    label: "Fahrrad",
    Icon: Bike,
    ring: "ring-lime-600/25 bg-lime-600/10",
    iconClass: "text-[#65a30d]",
  },
};

/** Welche Vergleichsspalte zur gewählten Teilstrecke passt (Fahrrad hat keine eigene Spalte). */
const LEG_MODE_TO_COMPARE_KEY: Partial<
  Record<TravelModeOption, "walking" | "driving" | "transit">
> = {
  WALKING: "walking",
  DRIVING: "driving",
  TRANSIT: "transit",
};

const COMPARE_CELL_SELECTED: Record<
  "walking" | "driving" | "transit",
  string
> = {
  walking:
    "border-blue-500/65 bg-blue-500/12 shadow-sm ring-1 ring-blue-500/30 dark:bg-blue-500/18",
  driving:
    "border-orange-500/65 bg-orange-500/12 shadow-sm ring-1 ring-orange-500/30 dark:bg-orange-500/18",
  transit:
    "border-planner-transit/65 bg-planner-transit/12 shadow-sm ring-1 ring-planner-transit/35 dark:bg-planner-transit/18",
};

function formatCompareMinutes(seconds: number | null): string {
  if (seconds === null) return "—";
  return `${Math.max(1, Math.ceil(seconds / 60))}`;
}

function LegModeChip({ mode }: { mode: TravelModeOption }) {
  const meta = MODE_META[mode];
  const Icon = meta.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        meta.ring,
        "text-foreground"
      )}
    >
      <Icon className={cn("size-3.5 shrink-0", meta.iconClass)} aria-hidden />
      {meta.label}
    </span>
  );
}

export function DayTimeline({ day, persistedContext }: Props) {
  const storeLegSeconds = useTripStore(
    (s) => s.routeLegDurationsByDayId[day.id]
  );
  const storeMultiMode = useTripStore(
    (s) => s.multiModeLegSecondsByDayId[day.id]
  );
  const storeTravelMode = useTripStore((s) => s.travelMode);

  const legSeconds = persistedContext?.legSeconds ?? storeLegSeconds;
  const multiMode = persistedContext?.multiMode ?? storeMultiMode;
  const travelMode = persistedContext?.travelMode ?? storeTravelMode;

  const sorted = useMemo(
    () => [...day.stops].sort((a, b) => a.order - b.order),
    [day.stops]
  );

  const computed = useMemo(
    () => computeDayItinerary(sorted, legSeconds ?? undefined, day),
    [sorted, legSeconds, day]
  );

  const implicitTargetStop = useMemo(
    () => getValidImplicitReturnTarget(day, sorted),
    [day, sorted]
  );
  const implicitFinalStop = useMemo(
    () => implicitReturnFinalStop(day, sorted),
    [day, sorted]
  );
  const implicitSegs = useMemo(
    () => implicitReturnSegmentStops(day, sorted),
    [day, sorted]
  );

  const implicitReturnArrivalMin = useMemo(() => {
    if (!computed.ok) return null;
    return implicitReturnArrivalTotalMin(computed.itinerary, sorted, day);
  }, [computed, sorted, day]);

  if (sorted.length === 0) {
    return null;
  }

  if (!day.date) {
    return (
      <div className="rounded-xl border border-dashed border-muted-foreground/35 bg-muted/40 px-4 py-3 text-muted-foreground text-sm leading-relaxed">
        Bitte ein <strong>Datum</strong> für diesen Tag setzen. Die Uhrzeiten
        beziehen sich dann auf diesen Kalendertag (wichtig für Verkehr /
        ÖPNV-Vorschläge).
      </div>
    );
  }

  if (!computed.ok) {
    if (computed.reason === "no_legs") {
      return (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-amber-950 text-sm leading-relaxed dark:text-amber-100">
          Mindestens zwei Stopps: Es wird eine berechnete{" "}
          <strong>Route</strong> benötigt, um Fahrzeiten zu schätzen. Kurz
          warten oder die Reihenfolge der Punkte prüfen.
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-dashed border-muted-foreground/35 bg-muted/40 px-4 py-3 text-muted-foreground text-sm leading-relaxed">
        Am <strong>ersten Stopp</strong> den <strong>Tagesbeginn</strong>{" "}
        eintragen (oder bei Unterkunft zuerst die <strong>Ankunft</strong>). Alle
        weiteren Ankünfte ergeben sich aus der Route; an normalen Stopps die{" "}
        <strong>Verweildauer</strong> setzen — nur an der Unterkunft zusätzlich
        Abreise.
      </div>
    );
  }

  const { stops, legs } = computed.itinerary;
  const nRouteLegs = expectedRouteLegCount(day, sorted);
  const multiLoading = persistedContext
    ? false
    : sorted.length >= 2 &&
        legSeconds &&
        legSeconds.length === nRouteLegs
      ? multiMode === null
      : false;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs leading-relaxed">
        Geplante Zeiten, Teilstrecken mit gewähltem Verkehrsmittel und
        ungefähre Alternativen (wenn die Karte geladen ist).
      </p>

      <div className="relative">
        <div
          className="absolute top-6 bottom-6 left-[1.125rem] w-px bg-border/80"
          aria-hidden
        />

        <ol className="relative list-none space-y-0 p-0">
        {stops.map((row, idx) => {
          const stop = sorted[idx];
          if (!stop) return null;
          const leg = idx < legs.length ? legs[idx]! : null;
          const nextStop =
            idx + 1 < sorted.length
              ? sorted[idx + 1]!
              : leg
                ? sorted.find((s) => s.id === leg.toStopId) ?? null
                : null;
          const legMode = legTravelModeForLegIndex(
            day,
            idx,
            travelMode,
            sorted
          );

          return (
            <li key={row.stopId} className="relative">
              <div className="flex gap-3 pb-1">
                <div className="relative z-[1] flex w-9 shrink-0 flex-col items-center">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full",
                      "bg-primary text-primary-foreground text-xs font-bold shadow-md",
                      "ring-4 ring-background"
                    )}
                  >
                    {idx + 1}
                  </span>
                </div>

                <article
                  className={cn(
                    "min-w-0 flex-1 rounded-2xl border border-border/80 bg-card/80 p-3.5 shadow-sm",
                    "backdrop-blur-sm dark:bg-card/60"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-foreground">
                      <Clock
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="font-semibold tabular-nums text-sm">
                        {formatTimeWindow(
                          row.arrivalTotalMin,
                          row.departureTotalMin
                        )}
                      </span>
                    </div>
                    {stop.isAccommodation ? (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Home className="size-3" aria-hidden />
                        Unterkunft
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-2 flex items-start gap-2">
                    <MapPin
                      className="mt-0.5 size-4 shrink-0 text-primary/80"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <h3 className="font-heading font-semibold text-[15px] leading-snug text-foreground">
                        {stop.label}
                      </h3>
                      <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
                        {stop.formattedAddress}
                      </p>
                    </div>
                  </div>
                  {stop.isAccommodation &&
                  implicitFinalStop &&
                  implicitFinalStop.id === stop.id &&
                  implicitReturnArrivalMin != null ? (
                    <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-amber-950 text-xs leading-snug dark:text-amber-100">
                      <span className="font-semibold">Heimkehr</span> nach dem
                      letzten Listen‑Stopp ca.{" "}
                      <span className="tabular-nums font-medium">
                        {formatScheduleMinutes(implicitReturnArrivalMin)}
                      </span>
                    </p>
                  ) : null}
                </article>
              </div>

              {leg && nextStop ? (
                <div className="flex gap-3 pb-6 pt-0.5">
                  <div className="flex w-9 shrink-0 justify-center pt-1">
                    <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 bg-muted/30 text-muted-foreground">
                      <ArrowDown className="size-3.5" aria-hidden />
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <LegModeChip mode={legMode} />
                      <span className="text-muted-foreground text-xs">
                        ca.{" "}
                        <span className="font-medium tabular-nums text-foreground">
                          {leg.travelMinutes}
                        </span>{" "}
                        Min.
                        {nextStop
                          ? ` bis „${nextStop.label}“`
                          : ""}
                        {idx + 1 >= sorted.length
                          ? " (Rückweg, kein neuer Listen‑Stopp)"
                          : null}
                      </span>
                    </div>

                    {multiLoading ? (
                      <p className="text-muted-foreground text-xs italic">
                        Vergleich (Fuß / Auto / ÖPNV) wird berechnet …
                      </p>
                    ) : multiMode && multiMode.walking.length > idx ? (
                      <div className="space-y-2 rounded-xl border border-border/70 bg-muted/25 p-3 dark:bg-muted/15">
                        <p className="font-medium text-foreground text-xs">
                          Vergleich dieser Teilstrecke
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {(
                            [
                              {
                                key: "walking" as const,
                                sec: multiMode.walking[idx]!,
                                label: "Fuß",
                                Icon: Footprints,
                                color: "text-[#1a73e8]",
                              },
                              {
                                key: "driving" as const,
                                sec: multiMode.driving[idx]!,
                                label: "Auto",
                                Icon: Car,
                                color: "text-[#ea580c]",
                              },
                              {
                                key: "transit" as const,
                                sec: multiMode.transit[idx]!,
                                label: "ÖPNV",
                                Icon: Bus,
                                color: "text-planner-transit",
                              },
                            ] as const
                          ).map(({ key, sec, label, Icon, color }) => {
                            const compareSelected =
                              LEG_MODE_TO_COMPARE_KEY[legMode] === key;
                            return (
                            <div
                              key={key}
                              aria-current={compareSelected || undefined}
                              className={cn(
                                "flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-2 text-center transition-colors",
                                compareSelected
                                  ? COMPARE_CELL_SELECTED[key]
                                  : "border-border/35 bg-background/75 dark:bg-background/35"
                              )}
                            >
                              <Icon
                                className={cn("size-4", color)}
                                aria-hidden
                              />
                              <span
                                className={cn(
                                  "text-[10px] font-medium uppercase tracking-wide",
                                  compareSelected
                                    ? "text-foreground"
                                    : "text-muted-foreground"
                                )}
                              >
                                {label}
                              </span>
                              <span className="font-semibold tabular-nums text-sm text-foreground">
                                {formatCompareMinutes(sec)}&nbsp;Min.
                              </span>
                            </div>
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1.5 border-t border-border/50 pt-2">
                          <a
                            className="inline-flex items-center gap-1 text-primary text-xs font-medium underline-offset-4 hover:underline"
                            href={buildGoogleMapsDirectionsUrl({
                              origin: { lat: stop.lat, lng: stop.lng },
                              destination: {
                                lat: nextStop.lat,
                                lng: nextStop.lng,
                              },
                              travelmode: "walking",
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Maps · Fuß
                            <ExternalLinkIcon className="size-3 opacity-70" />
                          </a>
                          <a
                            className="inline-flex items-center gap-1 text-primary text-xs font-medium underline-offset-4 hover:underline"
                            href={buildGoogleMapsDirectionsUrl({
                              origin: { lat: stop.lat, lng: stop.lng },
                              destination: {
                                lat: nextStop.lat,
                                lng: nextStop.lng,
                              },
                              travelmode: "driving",
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Maps · Auto
                            <ExternalLinkIcon className="size-3 opacity-70" />
                          </a>
                          <a
                            className="inline-flex items-center gap-1 text-primary text-xs font-medium underline-offset-4 hover:underline"
                            href={buildGoogleMapsDirectionsUrl({
                              origin: { lat: stop.lat, lng: stop.lng },
                              destination: {
                                lat: nextStop.lat,
                                lng: nextStop.lng,
                              },
                              travelmode: "transit",
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Maps · ÖPNV
                            <ExternalLinkIcon className="size-3 opacity-70" />
                          </a>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {idx === sorted.length - 1 &&
              implicitSegs.length >= 2 &&
              legs[sorted.length] &&
              implicitSegs[0] &&
              implicitSegs[1] ? (
                (() => {
                  const leg2 = legs[sorted.length]!;
                  const fromStop2 = implicitSegs[0]!;
                  const toStop2 = implicitSegs[1]!;
                  const leg2Mode = legTravelModeForLegIndex(
                    day,
                    sorted.length,
                    travelMode,
                    sorted
                  );
                  const leg2Idx = sorted.length;
                  return (
                    <div className="flex gap-3 pb-6 pt-0.5">
                      <div className="flex w-9 shrink-0 justify-center pt-1">
                        <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 bg-muted/30 text-muted-foreground">
                          <ArrowDown className="size-3.5" aria-hidden />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <LegModeChip mode={leg2Mode} />
                          <span className="text-muted-foreground text-xs">
                            ca.{" "}
                            <span className="font-medium tabular-nums text-foreground">
                              {leg2.travelMinutes}
                            </span>{" "}
                            Min. bis „{toStop2.label}“ (Rückweg, kein neuer
                            Listen‑Stopp)
                          </span>
                        </div>
                        {multiLoading ? (
                          <p className="text-muted-foreground text-xs italic">
                            Vergleich (Fuß / Auto / ÖPNV) wird berechnet …
                          </p>
                        ) : multiMode &&
                          multiMode.walking.length > leg2Idx ? (
                          <div className="space-y-2 rounded-xl border border-border/70 bg-muted/25 p-3 dark:bg-muted/15">
                            <p className="font-medium text-foreground text-xs">
                              Vergleich dieser Teilstrecke
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              {(
                                [
                                  {
                                    key: "walking" as const,
                                    sec: multiMode.walking[leg2Idx]!,
                                    label: "Fuß",
                                    Icon: Footprints,
                                    color: "text-[#1a73e8]",
                                  },
                                  {
                                    key: "driving" as const,
                                    sec: multiMode.driving[leg2Idx]!,
                                    label: "Auto",
                                    Icon: Car,
                                    color: "text-[#ea580c]",
                                  },
                                  {
                                    key: "transit" as const,
                                    sec: multiMode.transit[leg2Idx]!,
                                    label: "ÖPNV",
                                    Icon: Bus,
                                    color: "text-planner-transit",
                                  },
                                ] as const
                              ).map(({ key, sec, label, Icon, color }) => {
                                const compareSelected =
                                  LEG_MODE_TO_COMPARE_KEY[leg2Mode] === key;
                                return (
                                  <div
                                    key={key}
                                    aria-current={compareSelected || undefined}
                                    className={cn(
                                      "flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-2 text-center transition-colors",
                                      compareSelected
                                        ? COMPARE_CELL_SELECTED[key]
                                        : "border-border/35 bg-background/75 dark:bg-background/35"
                                    )}
                                  >
                                    <Icon
                                      className={cn("size-4", color)}
                                      aria-hidden
                                    />
                                    <span
                                      className={cn(
                                        "text-[10px] font-medium uppercase tracking-wide",
                                        compareSelected
                                          ? "text-foreground"
                                          : "text-muted-foreground"
                                      )}
                                    >
                                      {label}
                                    </span>
                                    <span className="font-semibold tabular-nums text-sm text-foreground">
                                      {formatCompareMinutes(sec)}&nbsp;Min.
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1.5 border-t border-border/50 pt-2">
                              <a
                                className="inline-flex items-center gap-1 text-primary text-xs font-medium underline-offset-4 hover:underline"
                                href={buildGoogleMapsDirectionsUrl({
                                  origin: {
                                    lat: fromStop2.lat,
                                    lng: fromStop2.lng,
                                  },
                                  destination: {
                                    lat: toStop2.lat,
                                    lng: toStop2.lng,
                                  },
                                  travelmode: "walking",
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Maps · Fuß
                                <ExternalLinkIcon className="size-3 opacity-70" />
                              </a>
                              <a
                                className="inline-flex items-center gap-1 text-primary text-xs font-medium underline-offset-4 hover:underline"
                                href={buildGoogleMapsDirectionsUrl({
                                  origin: {
                                    lat: fromStop2.lat,
                                    lng: fromStop2.lng,
                                  },
                                  destination: {
                                    lat: toStop2.lat,
                                    lng: toStop2.lng,
                                  },
                                  travelmode: "driving",
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Maps · Auto
                                <ExternalLinkIcon className="size-3 opacity-70" />
                              </a>
                              <a
                                className="inline-flex items-center gap-1 text-primary text-xs font-medium underline-offset-4 hover:underline"
                                href={buildGoogleMapsDirectionsUrl({
                                  origin: {
                                    lat: fromStop2.lat,
                                    lng: fromStop2.lng,
                                  },
                                  destination: {
                                    lat: toStop2.lat,
                                    lng: toStop2.lng,
                                  },
                                  travelmode: "transit",
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Maps · ÖPNV
                                <ExternalLinkIcon className="size-3 opacity-70" />
                              </a>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })()
              ) : null}
            </li>
          );
        })}
        </ol>
      </div>

      {implicitFinalStop &&
      implicitReturnArrivalMin != null &&
      computed.ok ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 dark:bg-amber-950/25">
          <div className="flex gap-2.5">
            <Home
              className="mt-0.5 size-5 shrink-0 text-amber-800 dark:text-amber-300"
              aria-hidden
            />
            <div className="min-w-0 space-y-1">
              <p className="font-semibold text-foreground text-sm">Heimkehr</p>
              <p className="text-muted-foreground text-xs leading-snug">
                Von „{sorted[sorted.length - 1]?.label ?? ""}“ zurück nach „
                {implicitFinalStop.label}“
                {implicitSegs.length >= 2 && implicitTargetStop ? (
                  <>
                    {" "}
                    (über „{implicitTargetStop.label}“)
                  </>
                ) : null}{" "}
                · Rückweg gesamt ca.{" "}
                <span className="tabular-nums font-medium text-foreground">
                  {(() => {
                    const bl = sorted.length - 1;
                    let m = 0;
                    for (let i = 0; i < implicitSegs.length; i++) {
                      m += legs[bl + i]?.travelMinutes ?? 0;
                    }
                    return m > 0 ? m : "—";
                  })()}
                </span>{" "}
                Min. · Ankunft ca.{" "}
                <span className="tabular-nums font-medium text-foreground">
                  {formatScheduleMinutes(implicitReturnArrivalMin)}
                </span>
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
