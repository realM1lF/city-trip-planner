"use client";

import { useCallback, useMemo, useRef } from "react";
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
import { GripVerticalIcon, HomeIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeTimeInput } from "@/components/ui/native-time-input";
import { Label } from "@/components/ui/label";
import {
  computeDayItinerary,
  formatScheduleMinutes,
  parseTimeToMinutes,
  travelMinutesFromLegSeconds,
} from "@/lib/itinerary-time";
import { legTravelModeForLegIndex } from "@/lib/leg-travel-modes";
import { DEFAULT_DAY_START_ARRIVAL } from "@/lib/trip-anchor";
import { PlaceAutocomplete } from "@/components/planner/PlaceAutocomplete";
import { useTripStore } from "@/stores/tripStore";
import type { TravelModeOption, TripStop } from "@/types/trip";
import { cn } from "@/lib/utils";

const LEG_MODE_LABEL_DE: Record<TravelModeOption, string> = {
  WALKING: "Zu Fuß",
  DRIVING: "Auto",
  BICYCLING: "Fahrrad",
  TRANSIT: "ÖPNV",
};

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

  const activeLegMode: TravelModeOption =
    index > 0 && day
      ? legTravelModeForLegIndex(day, index - 1, travelModeDefault)
      : travelModeDefault;

  const computed = useMemo(
    () => computeDayItinerary(sortedStops, legSeconds ?? undefined),
    [sortedStops, legSeconds]
  );

  const chainArrivalForOverride = useMemo(() => {
    if (index < 1 || !computed.ok) return null;
    const prev = computed.itinerary.stops[index - 1]!;
    const leg = computed.itinerary.legs[index - 1]!;
    return prev.departureTotalMin + leg.travelMinutes;
  }, [computed, index]);

  const userArrivalParsed = stop.arrivalTime?.trim()
    ? parseTimeToMinutes(stop.arrivalTime.trim())
    : null;
  const showEarliestRouteHint =
    index > 0 &&
    userArrivalParsed !== null &&
    chainArrivalForOverride !== null &&
    userArrivalParsed < chainArrivalForOverride;

  const legIdx = index - 1;
  const multiLoading =
    sortedStops.length >= 2 &&
    legSeconds &&
    legSeconds.length === sortedStops.length - 1
      ? multiMode === null
      : false;

  const modeSuggestions = useMemo(() => {
    if (index < 1 || !computed.ok || legIdx < 0) return null;
    if (!multiMode || multiMode.walking.length <= legIdx) return null;
    const prevDep = computed.itinerary.stops[index - 1]!.departureTotalMin;
    const toTotal = (sec: number | null) =>
      sec === null
        ? null
        : prevDep + travelMinutesFromLegSeconds(sec);
    return {
      walk: toTotal(multiMode.walking[legIdx] ?? null),
      drive: toTotal(multiMode.driving[legIdx] ?? null),
      transit: toTotal(multiMode.transit[legIdx] ?? null),
    };
  }, [computed, index, legIdx, multiMode]);

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
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              {isFirst ? (
                <>
                  <Label className="text-xs">
                    Ankunft{" "}
                    <span className="text-destructive" aria-hidden>
                      *
                    </span>
                  </Label>
                  <NativeTimeInput
                    required
                    aria-invalid={firstArrivalInvalid}
                    title={
                      firstArrivalInvalid
                        ? "Ankunft am ersten Stopp ist erforderlich (Tagesbeginn)."
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
                </>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Ankunft (optional)</Label>
                  <NativeTimeInput
                    value={stop.arrivalTime ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateStop(dayId, stop.id, {
                        arrivalTime:
                          v.trim() === "" ? undefined : v,
                      });
                    }}
                    onBlur={() => {
                      const p = stop.arrivalTime?.trim()
                        ? parseTimeToMinutes(stop.arrivalTime.trim())
                        : null;
                      if (
                        p === null ||
                        chainArrivalForOverride === null ||
                        p >= chainArrivalForOverride
                      ) {
                        return;
                      }
                      updateStop(dayId, stop.id, {
                        arrivalTime: formatScheduleMinutes(
                          chainArrivalForOverride
                        ),
                      });
                    }}
                  />
                </div>
              )}
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
                Leer: geschätzt über Verweildauer ({stop.dwellMinutes} Min.).
              </p>
            </div>
          </div>
          {!isFirst ? (
            <details className="min-w-0 w-full rounded-md border border-border/60 bg-muted/25 [&_summary::-webkit-details-marker]:hidden">
              <summary className="cursor-pointer list-none px-2 py-1.5 text-muted-foreground text-xs leading-snug select-none hover:text-foreground">
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <span>Route & Vorschläge</span>
                  {!isFirst ? (
                    <span className="rounded-md bg-muted/80 px-1.5 py-px font-medium text-foreground text-[10px]">
                      {LEG_MODE_LABEL_DE[activeLegMode]}
                    </span>
                  ) : null}
                  {showEarliestRouteHint ? (
                    <span
                      className="flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20 font-semibold text-[10px] text-amber-800 dark:text-amber-200"
                      aria-label="Routen-Hinweis vorhanden"
                      title="Routen-Hinweis vorhanden"
                    >
                      !
                    </span>
                  ) : null}
                </span>
              </summary>
              <div className="space-y-2 border-border/40 border-t px-2 pt-2 pb-1.5">
                {showEarliestRouteHint &&
                chainArrivalForOverride !== null ? (
                  <p className="text-amber-800 text-[11px] leading-snug dark:text-amber-200">
                    Frühestens{" "}
                    <span className="tabular-nums">
                      {formatScheduleMinutes(chainArrivalForOverride)}
                    </span>{" "}
                    laut Hauptroute — gewählte Zeit wurde angehoben.
                  </p>
                ) : null}
                {sortedStops.length >= 2 ? (
                  <div className="space-y-1.5">
                    <div className="text-muted-foreground text-[11px] leading-snug">
                      Vorschläge (Ankunft nach vorherigem Stopp + Teilstrecke):
                    </div>
                    <p className="text-muted-foreground/90 text-[11px] leading-snug">
                      Ankreuzen setzt die{" "}
                      <strong className="font-medium text-foreground/90">Teilstrecke</strong> vom
                      vorherigen Stopp hierher (Farbe auf der Karte). Vorgeschlagene Ankunftszeiten
                      bei Fuß, Auto und ÖPNV; Fahrrad ohne neue Zeit. Ohne Auswahl hier gilt für
                      diese Teilstrecke der Trip-Standard (bei neuen Reisen meist Zu Fuß).
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
                                setDayLegTravelMode(dayId, index - 1, "WALKING");
                                updateStop(dayId, stop.id, {
                                  arrivalTime: formatScheduleMinutes(
                                    modeSuggestions.walk!
                                  ),
                                });
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
                                setDayLegTravelMode(dayId, index - 1, "DRIVING");
                                updateStop(dayId, stop.id, {
                                  arrivalTime: formatScheduleMinutes(
                                    modeSuggestions.drive!
                                  ),
                                });
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
                                setDayLegTravelMode(dayId, index - 1, "TRANSIT");
                                updateStop(dayId, stop.id, {
                                  arrivalTime: formatScheduleMinutes(
                                    modeSuggestions.transit!
                                  ),
                                });
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
                              setDayLegTravelMode(dayId, index - 1, "BICYCLING");
                            }}
                          />
                          <span>Fahrrad (Ankunftszeit unverändert)</span>
                        </label>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-[11px]">
                        Keine Vergleichsroute — kurz warten oder Reihenfolge
                        prüfen.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </details>
          ) : null}
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

type StopListProps = { dayId: string; stops: TripStop[] };

export function StopList({ dayId, stops }: StopListProps) {
  const reorderStops = useTripStore((s) => s.reorderStops);
  const sorted = useMemo(
    () => [...stops].sort((a, b) => a.order - b.order),
    [stops]
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
          {sorted.map((stop, index) => (
            <SortableStopCard
              key={stop.id}
              stop={stop}
              index={index}
              dayId={dayId}
              sortedStops={sorted}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
