"use client";

import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, HomeIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeTimeInput } from "@/components/ui/native-time-input";
import { Label } from "@/components/ui/label";
import {
  computeDayItinerary,
  formatScheduleMinutes,
  implicitReturnArrivalTotalMin,
  travelMinutesFromLegSeconds,
  type ItineraryResult,
} from "@/lib/itinerary-time";
import {
  expectedRouteLegCount,
  getValidImplicitReturnTarget,
  legTravelModeForLegIndex,
} from "@/lib/leg-travel-modes";
import { DEFAULT_DAY_START_ARRIVAL } from "@/lib/trip-anchor";
import {
  findFirstDuplicateStop,
  type AutocompletePlacePick,
} from "@/lib/stop-duplicate";
import { PlaceAutocomplete } from "@/components/planner/PlaceAutocomplete";
import { useTripStore } from "@/stores/tripStore";
import type {
  MultiModeLegSeconds,
  TravelModeOption,
  TripDay,
  TripStop,
} from "@/types/trip";
import { cn } from "@/lib/utils";

const LEG_MODE_LABEL_DE: Record<TravelModeOption, string> = {
  WALKING: "Zu Fuß",
  DRIVING: "Auto",
  BICYCLING: "Fahrrad",
  TRANSIT: "ÖPNV",
};

function LegRouteDetails({
  dayId,
  day,
  sortedStops,
  legIndex,
  travelModeDefault,
  routeKindLabel,
  routeDescription,
  arrivalStop,
  computed,
  multiMode,
  multiLoading,
  chainArrivalTotalMin,
  setDayLegTravelMode,
}: {
  dayId: string;
  day: TripDay | undefined;
  sortedStops: TripStop[];
  legIndex: number;
  travelModeDefault: TravelModeOption;
  routeKindLabel: string;
  routeDescription: string;
  arrivalStop: TripStop;
  computed: ItineraryResult;
  multiMode: MultiModeLegSeconds | null | undefined;
  multiLoading: boolean;
  chainArrivalTotalMin: number | null;
  setDayLegTravelMode: (
    dayId: string,
    legIndex: number,
    mode: TravelModeOption
  ) => void;
}) {
  const activeLegMode: TravelModeOption =
    day && legIndex >= 0
      ? legTravelModeForLegIndex(
          day,
          legIndex,
          travelModeDefault,
          sortedStops
        )
      : travelModeDefault;

  const modeSuggestions =
    computed.ok &&
    legIndex >= 0 &&
    multiMode &&
    multiMode.walking.length > legIndex
      ? (() => {
          const prevDep = computed.itinerary.stops[legIndex]!.departureTotalMin;
          const toTotal = (sec: number | null) =>
            sec === null ? null : prevDep + travelMinutesFromLegSeconds(sec);
          return {
            walk: toTotal(multiMode.walking[legIndex] ?? null),
            drive: toTotal(multiMode.driving[legIndex] ?? null),
            transit: toTotal(multiMode.transit[legIndex] ?? null),
          };
        })()
      : null;

  return (
    <details className="min-w-0 w-full rounded-md border border-border/60 bg-muted/25 [&_summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer list-none px-2 py-1.5 text-muted-foreground text-xs leading-snug select-none hover:text-foreground">
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span>Route · {routeKindLabel}</span>
          <span className="rounded-md bg-muted/80 px-1.5 py-px font-medium text-foreground text-[10px]">
            {LEG_MODE_LABEL_DE[activeLegMode]}
          </span>
        </span>
      </summary>
      <div className="space-y-2 border-border/40 border-t px-2 pt-2 pb-1.5">
        <p className="text-muted-foreground text-[11px] leading-snug">
          {routeDescription}
        </p>
        {computed.ok &&
        chainArrivalTotalMin !== null &&
        !arrivalStop.isAccommodation ? (
          <p className="text-muted-foreground text-[11px] leading-snug">
            Voraussichtliche Ankunft in „{arrivalStop.label}“:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {formatScheduleMinutes(chainArrivalTotalMin)}
            </span>
          </p>
        ) : null}
        {sortedStops.length >= 2 ? (
          <div className="space-y-1.5">
            <div className="text-muted-foreground text-[11px] leading-snug">
              Vorschläge (Abfahrt am Start dieser Teilstrecke + Fahrzeit):
            </div>
            <p className="text-muted-foreground/90 text-[11px] leading-snug">
              Ankreuzen wählt das{" "}
              <strong className="font-medium text-foreground/90">
                Verkehrsmittel
              </strong>{" "}
              für dieses Teilstück (Farbe auf der Karte — dieselbe Linie wie
              beim Klick). Die Ankunft am Ziel ergibt sich automatisch aus der
              Route.
            </p>
            {multiLoading ? (
              <p className="text-muted-foreground/80 text-[11px] italic">
                Fuß / Auto / ÖPNV werden berechnet …
              </p>
            ) : modeSuggestions ? (
              <div className="flex flex-col gap-1.5">
                {modeSuggestions.walk !== null ? (
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5 text-left text-xs leading-snug hover:bg-muted/40">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
                      checked={activeLegMode === "WALKING"}
                      onChange={(e) => {
                        if (!e.target.checked) return;
                        setDayLegTravelMode(dayId, legIndex, "WALKING");
                      }}
                    />
                    <span>
                      Zu Fuß ca.{" "}
                      <span className="tabular-nums">
                        {formatScheduleMinutes(modeSuggestions.walk)}
                      </span>{" "}
                      Uhr
                    </span>
                  </label>
                ) : null}
                {modeSuggestions.drive !== null ? (
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5 text-left text-xs leading-snug hover:bg-muted/40">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
                      checked={activeLegMode === "DRIVING"}
                      onChange={(e) => {
                        if (!e.target.checked) return;
                        setDayLegTravelMode(dayId, legIndex, "DRIVING");
                      }}
                    />
                    <span>
                      Auto ca.{" "}
                      <span className="tabular-nums">
                        {formatScheduleMinutes(modeSuggestions.drive)}
                      </span>{" "}
                      Uhr
                    </span>
                  </label>
                ) : null}
                {modeSuggestions.transit !== null ? (
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5 text-left text-xs leading-snug hover:bg-muted/40">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
                      checked={activeLegMode === "TRANSIT"}
                      onChange={(e) => {
                        if (!e.target.checked) return;
                        setDayLegTravelMode(dayId, legIndex, "TRANSIT");
                      }}
                    />
                    <span>
                      ÖPNV ca.{" "}
                      <span className="tabular-nums">
                        {formatScheduleMinutes(modeSuggestions.transit)}
                      </span>{" "}
                      Uhr
                    </span>
                  </label>
                ) : null}
                <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5 text-left text-xs leading-snug hover:bg-muted/40">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
                    checked={activeLegMode === "BICYCLING"}
                    onChange={(e) => {
                      if (!e.target.checked) return;
                      setDayLegTravelMode(dayId, legIndex, "BICYCLING");
                    }}
                  />
                  <span>Fahrrad (Dauer laut Hauptroute)</span>
                </label>
              </div>
            ) : (
              <p className="text-muted-foreground text-[11px]">
                Keine Vergleichsroute — kurz warten oder Reihenfolge prüfen.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function SortableStopCard({
  stop,
  index,
  dayId,
  sortedStops,
}: {
  stop: TripStop;
  index: number;
  dayId: string;
  sortedStops: TripStop[];
}) {
  const updateStop = useTripStore((s) => s.updateStop);
  const setDayLegTravelMode = useTripStore((s) => s.setDayLegTravelMode);
  const removeStop = useTripStore((s) => s.removeStop);
  const day = useTripStore((s) => s.trip.days.find((d) => d.id === dayId));
  const travelModeDefault = useTripStore((s) => s.travelMode);
  const legSeconds = useTripStore((s) => s.routeLegDurationsByDayId[dayId]);
  const multiMode = useTripStore((s) => s.multiModeLegSecondsByDayId[dayId]);

  const computed = useMemo(
    () =>
      day
        ? computeDayItinerary(sortedStops, legSeconds ?? undefined, day)
        : computeDayItinerary(sortedStops, legSeconds ?? undefined),
    [sortedStops, legSeconds, day]
  );

  const nRouteLegs =
    day && sortedStops.length >= 2
      ? expectedRouteLegCount(day, sortedStops)
      : 0;
  const multiLoading =
    sortedStops.length >= 2 &&
    legSeconds &&
    day &&
    nRouteLegs > 0 &&
    legSeconds.length === nRouteLegs
      ? multiMode === null
      : false;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stop.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isFirst = index === 0;
  const firstArrivalInvalid = isFirst && !stop.arrivalTime?.trim();

  const replacePlaceDetailsRef = useRef<HTMLDetailsElement>(null);

  const handleReplacePlace = useCallback(
    (place: {
      placeId?: string;
      lat: number;
      lng: number;
      formattedAddress: string;
      label: string;
      thumbnailUrl?: string;
    }) => {
      updateStop(dayId, stop.id, {
        label: place.label,
        placeId: place.placeId,
        lat: place.lat,
        lng: place.lng,
        formattedAddress: place.formattedAddress,
        ...(place.thumbnailUrl
          ? { thumbnailUrl: place.thumbnailUrl }
          : { thumbnailUrl: undefined }),
      });
      toast.success("Ort aktualisiert");
      replacePlaceDetailsRef.current?.removeAttribute("open");
    },
    [dayId, stop.id, updateStop]
  );

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "space-y-2 border border-border/45 bg-white/55 p-3 shadow-sm ring-0 backdrop-blur-[2px]",
        isDragging && "z-10 opacity-90 shadow-lg"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="Reihenfolge ziehen"
        >
          <GripVerticalIcon className="size-4" />
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="h-5 min-h-5 gap-1 px-2 py-0 text-xs leading-none tabular-nums"
            >
              {stop.isAccommodation ? (
                <HomeIcon
                  className="size-3 shrink-0 opacity-90"
                  aria-hidden
                />
              ) : null}
              <span className="flex items-center leading-none">
                {index + 1}
              </span>
            </Badge>
            <span className="truncate font-medium text-sm">{stop.label}</span>
          </div>
          <p className="line-clamp-2 text-muted-foreground text-xs">
            {stop.formattedAddress}
          </p>
          <details
            ref={replacePlaceDetailsRef}
            className="min-w-0 w-full rounded-md border border-border/60 bg-muted/25 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="cursor-pointer list-none px-2 py-1.5 text-muted-foreground text-xs leading-snug select-none hover:text-foreground">
              Ort ersetzen
            </summary>
            <div className="space-y-2 border-border/40 border-t px-2 pt-2 pb-1.5">
              <p className="text-muted-foreground text-[11px] leading-snug">
                Neuen Ort über die Suche wählen — Position und Adresse
                werden ersetzt, Uhrzeiten und Notizen bleiben erhalten.
              </p>
              <PlaceAutocomplete
                key={`${stop.id}-${String(stop.lat)}-${String(stop.lng)}`}
                placeholder="Neuen Ort suchen …"
                onPlaceSelected={handleReplacePlace}
              />
            </div>
          </details>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`stop-lodging-${stop.id}`}
              checked={!!stop.isAccommodation}
              onChange={(e) =>
                updateStop(dayId, stop.id, {
                  isAccommodation: e.target.checked,
                })
              }
              className="size-4 shrink-0 rounded border border-input accent-primary"
            />
            <Label
              htmlFor={`stop-lodging-${stop.id}`}
              className="cursor-pointer text-xs font-normal leading-none text-foreground"
            >
              Ist Unterkunft
            </Label>
          </div>
          {stop.isAccommodation ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">
                  Ankunft{" "}
                  {!isFirst ? null : (
                    <span className="text-destructive" aria-hidden>
                      *
                    </span>
                  )}
                </Label>
                <NativeTimeInput
                  required={isFirst}
                  aria-invalid={isFirst ? firstArrivalInvalid : undefined}
                  title={
                    isFirst && firstArrivalInvalid
                      ? "Ankunft an der Unterkunft (Tagesanker, falls erster Stopp)."
                      : undefined
                  }
                  value={stop.arrivalTime ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateStop(dayId, stop.id, {
                      arrivalTime:
                        v.trim() !== ""
                          ? v
                          : isFirst
                            ? DEFAULT_DAY_START_ARRIVAL
                            : undefined,
                    });
                  }}
                  onBlur={() => {
                    if (isFirst && !stop.arrivalTime?.trim()) {
                      updateStop(dayId, stop.id, {
                        arrivalTime: DEFAULT_DAY_START_ARRIVAL,
                      });
                    }
                  }}
                />
                {isFirst && firstArrivalInvalid ? (
                  <p className="text-destructive text-[11px] leading-snug">
                    Bitte eine Uhrzeit wählen.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Abreise</Label>
                <NativeTimeInput
                  value={stop.departureTime ?? ""}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    updateStop(dayId, stop.id, {
                      departureTime: v.trim() === "" ? undefined : v,
                    });
                  }}
                  onBlur={(e) => {
                    const v = e.currentTarget.value;
                    updateStop(dayId, stop.id, {
                      departureTime: v.trim() === "" ? undefined : v,
                    });
                  }}
                />
                <p className="text-muted-foreground text-[10px] leading-snug">
                  Leer: Abreise = Ankunft + Verweildauer.
                </p>
              </div>
            </div>
          ) : isFirst ? (
            <div className="space-y-1">
              <Label className="text-xs">
                Tagesbeginn / erste Ankunft{" "}
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <NativeTimeInput
                required
                aria-invalid={firstArrivalInvalid}
                title={
                  firstArrivalInvalid
                    ? "Zeitpunkt, zu dem du am ersten Ort bist (Anker für den Tag)."
                    : undefined
                }
                value={stop.arrivalTime ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  updateStop(dayId, stop.id, {
                    arrivalTime:
                      v.trim() !== ""
                        ? v
                        : DEFAULT_DAY_START_ARRIVAL,
                  });
                }}
                onBlur={() => {
                  if (!stop.arrivalTime?.trim()) {
                    updateStop(dayId, stop.id, {
                      arrivalTime: DEFAULT_DAY_START_ARRIVAL,
                    });
                  }
                }}
              />
              {firstArrivalInvalid ? (
                <p className="text-destructive text-[11px] leading-snug">
                  Bitte eine Uhrzeit wählen (Anker für den Tag).
                </p>
              ) : null}
            </div>
          ) : (
            computed.ok && (
              <p className="text-muted-foreground text-[11px] leading-snug">
                Ankunft (aus Route):{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {formatScheduleMinutes(
                    computed.itinerary.stops[index]!.arrivalTotalMin
                  )}
                </span>
              </p>
            )
          )}
          <div className="space-y-1">
            <Label className="text-xs">Verweildauer (Minuten)</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={5}
              className="tabular-nums"
              value={stop.dwellMinutes}
              onChange={(e) => {
                const raw = e.target.value;
                const n =
                  raw === ""
                    ? 0
                    : Math.max(0, Math.floor(Number(raw) || 0));
                updateStop(dayId, stop.id, { dwellMinutes: n });
              }}
            />
            <p className="text-muted-foreground text-[10px] leading-snug">
              Abreise an normalen Stopps = Ankunft + Verweildauer.
            </p>
          </div>
          <div className="space-y-2">
            {index > 0 ? (
              <LegRouteDetails
                dayId={dayId}
                day={day}
                sortedStops={sortedStops}
                legIndex={index - 1}
                travelModeDefault={travelModeDefault}
                routeKindLabel="Anfahrt"
                routeDescription={`Vom vorherigen Stopp („${sortedStops[index - 1]?.label ?? ""}“) hierher.`}
                arrivalStop={stop}
                computed={computed}
                multiMode={multiMode}
                multiLoading={multiLoading}
                chainArrivalTotalMin={
                  computed.ok
                    ? computed.itinerary.stops[index - 1]!.departureTotalMin +
                      computed.itinerary.legs[index - 1]!.travelMinutes
                    : null
                }
                setDayLegTravelMode={setDayLegTravelMode}
              />
            ) : null}
            {index < sortedStops.length - 1 ? (
              <LegRouteDetails
                dayId={dayId}
                day={day}
                sortedStops={sortedStops}
                legIndex={index}
                travelModeDefault={travelModeDefault}
                routeKindLabel="Weiterfahrt"
                routeDescription={`Von hier zu „${sortedStops[index + 1]?.label ?? "nächster Stopp"}“ — dieselbe Teilstrecke wie der Kartenstrich ab diesem Ort.`}
                arrivalStop={sortedStops[index + 1]!}
                computed={computed}
                multiMode={multiMode}
                multiLoading={multiLoading}
                chainArrivalTotalMin={
                  computed.ok
                    ? computed.itinerary.stops[index]!.departureTotalMin +
                      computed.itinerary.legs[index]!.travelMinutes
                    : null
                }
                setDayLegTravelMode={setDayLegTravelMode}
              />
            ) : null}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notiz</Label>
            <Input
              placeholder="…"
              value={stop.notes ?? ""}
              onChange={(e) =>
                updateStop(dayId, stop.id, {
                  notes: e.target.value || undefined,
                })
              }
            />
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-destructive"
          onClick={() => removeStop(dayId, stop.id)}
          aria-label="Stopp entfernen"
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>
    </Card>
  );
}

type PlaceFromAutocomplete = {
  placeId?: string;
  lat: number;
  lng: number;
  formattedAddress: string;
  label: string;
  thumbnailUrl?: string;
};

function StopInsertSlot({
  insertIndex,
  onInsertPlace,
}: {
  insertIndex: number;
  onInsertPlace: (
    place: PlaceFromAutocomplete,
    insertIndex: number,
    onSuccess?: () => void
  ) => void;
}) {
  const [open, setOpen] = useState(false);

  const handlePlace = useCallback(
    (place: PlaceFromAutocomplete) => {
      onInsertPlace(place, insertIndex, () => setOpen(false));
    },
    [insertIndex, onInsertPlace]
  );

  return (
    <div className="flex w-full flex-col items-center">
      <div
        className="min-h-2 w-px shrink-0 bg-border/80"
        aria-hidden
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(
          "size-9 shrink-0 rounded-full border-dashed text-muted-foreground shadow-none",
          "hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
        )}
        aria-expanded={open}
        aria-label="Stopp hier einfügen"
        title="Stopp hier einfügen"
        onClick={() => setOpen((v) => !v)}
      >
        <PlusIcon className="size-4" />
      </Button>
      <div
        className="min-h-2 w-px shrink-0 bg-border/80"
        aria-hidden
      />
      {open ? (
        <div className="mt-1 w-full min-w-0 rounded-lg border border-border/70 bg-muted/20 p-2">
          <p className="mb-2 text-muted-foreground text-[11px] leading-snug">
            Ort wählen — wird an Position {insertIndex + 1} eingefügt.
          </p>
          <PlaceAutocomplete
            placeholder="Ort suchen …"
            onPlaceSelected={handlePlace}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Letzte Teilstrecke: letzter Listen‑Stopp → bereits existierender Stopp (meist Unterkunft). */
function ImplicitReturnCard({
  dayId,
  sortedStops,
}: {
  dayId: string;
  sortedStops: TripStop[];
}) {
  const day = useTripStore((s) => s.trip.days.find((d) => d.id === dayId));
  const setDayImplicitReturn = useTripStore((s) => s.setDayImplicitReturn);
  const travelModeDefault = useTripStore((s) => s.travelMode);
  const legSeconds = useTripStore((s) => s.routeLegDurationsByDayId[dayId]);
  const multiMode = useTripStore((s) => s.multiModeLegSecondsByDayId[dayId]);
  const setDayLegTravelMode = useTripStore((s) => s.setDayLegTravelMode);

  const target = useMemo(
    () => (day ? getValidImplicitReturnTarget(day, sortedStops) : null),
    [day, sortedStops]
  );

  const computed = useMemo(
    () =>
      day
        ? computeDayItinerary(sortedStops, legSeconds ?? undefined, day)
        : computeDayItinerary(sortedStops, legSeconds ?? undefined),
    [day, sortedStops, legSeconds]
  );

  const homeArrivalMin = useMemo(
    () =>
      computed.ok && day
        ? implicitReturnArrivalTotalMin(computed.itinerary, sortedStops, day)
        : null,
    [computed, day, sortedStops]
  );

  if (!target || !day) return null;

  const last = sortedStops[sortedStops.length - 1]!;
  const legIndex = sortedStops.length - 1;

  const nRouteLegs = expectedRouteLegCount(day, sortedStops);
  const multiLoading =
    sortedStops.length >= 2 &&
    legSeconds &&
    legSeconds.length === nRouteLegs
      ? multiMode === null
      : false;

  const chainArrivalTotalMin =
    computed.ok && computed.itinerary.legs.length > 0
      ? computed.itinerary.stops[sortedStops.length - 1]!.departureTotalMin +
        computed.itinerary.legs[computed.itinerary.legs.length - 1]!
          .travelMinutes
      : null;

  return (
    <Card
      className={cn(
        "space-y-2 border border-dashed border-primary/40 bg-primary/[0.06] p-3 shadow-sm",
        "dark:bg-primary/10"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <HomeIcon className="size-3" aria-hidden />
            Heimkehr
          </Badge>
          <p className="text-muted-foreground text-[11px] leading-snug">
            Vom letzten Stopp „{last.label}“ zurück zu „{target.label}“ — kein
            zweiter Eintrag in der Liste; nur die Rück‑Route auf der Karte.
          </p>
          {homeArrivalMin != null ? (
            <p className="font-medium text-foreground text-xs tabular-nums">
              Ankunft am Ziel ca. {formatScheduleMinutes(homeArrivalMin)}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            setDayImplicitReturn(dayId, null);
            toast.message("Heimkehr entfernt.");
          }}
          aria-label="Heimkehr entfernen"
        >
          Entfernen
        </Button>
      </div>
      <LegRouteDetails
        dayId={dayId}
        day={day}
        sortedStops={sortedStops}
        legIndex={legIndex}
        travelModeDefault={travelModeDefault}
        routeKindLabel="Rückweg"
        routeDescription={`Vom letzten Stopp („${last.label}“) zurück zu „${target.label}“.`}
        arrivalStop={target}
        computed={computed}
        multiMode={multiMode}
        multiLoading={multiLoading}
        chainArrivalTotalMin={chainArrivalTotalMin}
        setDayLegTravelMode={setDayLegTravelMode}
      />
    </Card>
  );
}

type StopListProps = { dayId: string; stops: TripStop[] };

export function StopList({ dayId, stops }: StopListProps) {
  const reorderStops = useTripStore((s) => s.reorderStops);
  const insertStopAt = useTripStore((s) => s.insertStopAt);
  const setDayImplicitReturn = useTripStore((s) => s.setDayImplicitReturn);
  const sorted = useMemo(
    () => [...stops].sort((a, b) => a.order - b.order),
    [stops]
  );

  const onInsertPlace = useCallback(
    (
      place: PlaceFromAutocomplete,
      insertIndex: number,
      onSuccess?: () => void
    ) => {
      const pick: AutocompletePlacePick = {
        placeId: place.placeId,
        formattedAddress: place.formattedAddress,
        lat: place.lat,
        lng: place.lng,
      };
      const dup = findFirstDuplicateStop(sorted, pick);
      if (dup) {
        if (insertIndex === sorted.length) {
          const last = sorted[sorted.length - 1];
          if (last && last.id === dup.stop.id) {
            toast.message(
              `„${place.label}“ ist bereits der letzte Stopp — nichts geändert.`
            );
            return;
          }
          setDayImplicitReturn(dayId, dup.stop.id);
          toast.message(
            `„${place.label}“ gibt es schon (Stopp ${dup.displayIndex}). Rückweg auf der Karte — ohne doppelten Listen‑Eintrag.`
          );
          onSuccess?.();
          return;
        }
        toast.message(
          `„${place.label}“ ist bereits Stopp ${dup.displayIndex} — hier nicht eingefügt.`
        );
        return;
      }
      insertStopAt(dayId, insertIndex, {
        label: place.label,
        placeId: place.placeId,
        lat: place.lat,
        lng: place.lng,
        formattedAddress: place.formattedAddress,
        thumbnailUrl: place.thumbnailUrl,
        dwellMinutes: 30,
      });
      toast.success("Stopp eingefügt");
      onSuccess?.();
    },
    [dayId, insertStopAt, setDayImplicitReturn, sorted]
  );

  /** Nur bei Id/Reihenfolge neu, nicht bei jedem Text-/Zeitfeld-Update — sonst resettet dnd-kit / Fokus in der Leiste. */
  const sortableOrderKey = sorted.map((s) => `${s.id}:${s.order}`).join("|");
  const sortableItemIds = useMemo(
    () => sorted.map((s) => s.id),
    [sortableOrderKey]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex((s) => s.id === active.id);
    const newIndex = sorted.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    reorderStops(dayId, oldIndex, newIndex);
  }

  if (sorted.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Noch keine Stopps. Suche oben einen Ort und füge ihn hinzu.
      </p>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sortableItemIds}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          <StopInsertSlot insertIndex={0} onInsertPlace={onInsertPlace} />
          {sorted.map((stop, index) => (
            <Fragment key={stop.id}>
              <SortableStopCard
                stop={stop}
                index={index}
                dayId={dayId}
                sortedStops={sorted}
              />
              <StopInsertSlot
                insertIndex={index + 1}
                onInsertPlace={onInsertPlace}
              />
            </Fragment>
          ))}
          <ImplicitReturnCard dayId={dayId} sortedStops={sorted} />
        </div>
      </SortableContext>
    </DndContext>
  );
}
