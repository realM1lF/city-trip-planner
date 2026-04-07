"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { PlusIcon, CalendarClockIcon, MapPinIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DayTimeline } from "@/components/planner/DayTimeline";
import { PlaceAutocomplete } from "@/components/planner/PlaceAutocomplete";
import { StopList } from "@/components/planner/StopList";
import { tripRegionSummary } from "@/lib/trip-region";
import { useTripStore } from "@/stores/tripStore";
import { cn } from "@/lib/utils";

export function PlannerPanel() {
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const trip = useTripStore((s) => s.trip);
  const activeDayId = useTripStore((s) => s.activeDayId);
  const optimizeWaypoints = useTripStore((s) => s.optimizeWaypoints);
  const setTripName = useTripStore((s) => s.setTripName);
  const setActiveDay = useTripStore((s) => s.setActiveDay);
  const addDay = useTripStore((s) => s.addDay);
  const updateDayLabel = useTripStore((s) => s.updateDayLabel);
  const updateDayDate = useTripStore((s) => s.updateDayDate);
  const addStop = useTripStore((s) => s.addStop);
  const setOptimizeWaypoints = useTripStore((s) => s.setOptimizeWaypoints);

  const activeDay = trip.days.find((d) => d.id === activeDayId);

  const regionLine = useMemo(() => tripRegionSummary(trip), [trip]);

  const handlePlace = useCallback(
    (place: {
      placeId?: string;
      lat: number;
      lng: number;
      formattedAddress: string;
      label: string;
      thumbnailUrl?: string;
    }) => {
      addStop(activeDayId, {
        label: place.label,
        placeId: place.placeId,
        lat: place.lat,
        lng: place.lng,
        formattedAddress: place.formattedAddress,
        thumbnailUrl: place.thumbnailUrl,
        dwellMinutes: 30,
      });
      toast.success("Stopp hinzugefügt");
    },
    [activeDayId, addStop]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3 space-y-3 shrink-0">
        <div className="space-y-1">
          <Label htmlFor="trip-name" className="text-xs text-muted-foreground">
            Trip-Name
          </Label>
          <Input
            id="trip-name"
            value={trip.name}
            onChange={(e) => setTripName(e.target.value)}
          />
          {regionLine ? (
            <p
              className="text-muted-foreground text-xs leading-snug"
              title="Aus den Stopp-Adressen geschätzt — dient nur der Orientierung."
            >
              Gebiet: {regionLine}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2 border-b px-4 py-3 shrink-0">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="optimize"
              checked={optimizeWaypoints}
              onChange={(e) => setOptimizeWaypoints(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            <Label htmlFor="optimize" className="text-xs font-normal">
              Zwischenstopps optimieren (nur bei 3+ Punkten)
            </Label>
          </div>
          <p className="text-muted-foreground text-[10px] leading-snug pl-6">
            Route zeigt je Teilstrecke einen Modus; Reihenfolge-Optimierung ist
            damit derzeit wirkungslos.
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <Tabs
          value={activeDayId}
          onValueChange={setActiveDay}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="border-b px-2 pt-2 shrink-0">
            <TabsList variant="line" className="mb-2 h-auto w-full min-h-8 flex-wrap justify-start gap-1 bg-transparent p-0">
              {trip.days.map((d) => (
                <TabsTrigger key={d.id} value={d.id} className="shrink-0">
                  {d.label}
                </TabsTrigger>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2"
                onClick={() => addDay()}
              >
                <PlusIcon className="size-3.5" />
                Tag
              </Button>
            </TabsList>
          </div>

          {trip.days.map((d) => (
            <TabsContent
              key={d.id}
              value={d.id}
              keepMounted
              className="mt-0 flex min-h-0 flex-1 flex-col data-[slot=tabs-content]:flex-1"
            >
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-4 p-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Tag-Name</Label>
                      <Input
                        value={d.label}
                        onChange={(e) => updateDayLabel(d.id, e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Datum</Label>
                      <Input
                        type="date"
                        value={d.date ?? ""}
                        onChange={(e) =>
                          updateDayDate(
                            d.id,
                            e.target.value ? e.target.value : null
                          )
                        }
                      />
                    </div>
                  </div>

                  <Separator />

                  <div
                    className={cn(
                      "rounded-xl border-2 border-primary/28 bg-white p-3 shadow-sm",
                      "ring-1 ring-primary/10 dark:border-primary/30 dark:bg-white"
                    )}
                  >
                    <div className="mb-2.5 flex items-start gap-2.5">
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary shadow-sm dark:bg-primary/25"
                        aria-hidden
                      >
                        <MapPinIcon className="size-[1.125rem]" strokeWidth={2.25} />
                      </span>
                      <div className="min-w-0 pt-0.5 text-neutral-900">
                        <p className="font-heading font-semibold text-sm leading-tight">
                          Ort hinzufügen
                        </p>
                        <p className="mt-0.5 text-neutral-600 text-xs leading-snug">
                          Adresse, Viertel oder Sehenswürdigkeit suchen — Auswahl
                          übernimmt den Stopp in den Tag.
                        </p>
                      </div>
                    </div>
                    <PlaceAutocomplete onPlaceSelected={handlePlace} />
                  </div>

                  <Separator />

                  <StopList dayId={d.id} stops={d.stops} />

                  <Separator />

                  <div className="hidden md:block">
                    <DayTimeline day={d} />
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>

        {activeDay && activeDay.stops.length > 0 ? (
          <div className="shrink-0 border-t border-border/80 bg-background/95 px-3 py-2 backdrop-blur-sm supports-backdrop-filter:bg-background/85">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 w-full gap-2 font-medium shadow-sm"
              onClick={() => setPlanSheetOpen(true)}
            >
              <CalendarClockIcon className="size-4 shrink-0" />
              Tagesablauf · {activeDay.label}
            </Button>
          </div>
        ) : null}
      </div>

      <Sheet open={planSheetOpen} onOpenChange={setPlanSheetOpen}>
        <SheetContent
          side="bottom"
          showCloseButton
          className={cn(
            "flex max-h-[min(82dvh,560px)] min-h-0 flex-col gap-0 overflow-hidden rounded-t-2xl p-0",
            "sm:max-w-lg"
          )}
          initialFocus={() => false}
        >
          <SheetHeader className="shrink-0 border-b border-border/60 px-4 py-3 text-left">
            <SheetTitle className="font-heading text-base leading-snug">
              Tagesablauf
              {activeDay ? (
                <span className="mt-0.5 block font-normal text-muted-foreground text-sm">
                  {activeDay.label}
                  {activeDay.date
                    ? ` · ${new Date(activeDay.date + "T12:00:00").toLocaleDateString("de-DE", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}`
                    : null}
                </span>
              ) : null}
            </SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-6">
            {activeDay ? <DayTimeline day={activeDay} /> : null}
          </div>
        </SheetContent>
      </Sheet>

      {!activeDay && (
        <p className="p-4 text-destructive text-sm">Kein aktiver Tag.</p>
      )}
    </div>
  );
}
