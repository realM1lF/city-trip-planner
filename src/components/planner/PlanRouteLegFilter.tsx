"use client";

import { ChevronDown, Flag } from "lucide-react";
import { useMemo } from "react";
import { expectedRouteLegCount } from "@/lib/leg-travel-modes";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/stores/tripStore";
import type { Trip } from "@/types/trip";

const shell =
  "pointer-events-auto w-full max-w-[min(calc(100vw-3.75rem),18rem)] rounded-xl border border-border/80 bg-background/90 text-sm shadow-sm backdrop-blur-md md:max-w-[280px] [&_summary::-webkit-details-marker]:hidden group";

export type PlanRouteLegFilterPlannerContext = {
  trip: Trip;
  activeDayId: string;
  mapVisibleLegIndex: number | null;
  setMapVisibleLegIndex: (v: number | null) => void;
};

export function PlanRouteLegFilter({
  className,
  variant = "accordion",
  plannerContext,
}: {
  className?: string;
  variant?: "accordion" | "sheetChips";
  plannerContext?: PlanRouteLegFilterPlannerContext;
}) {
  const storeTrip = useTripStore((s) => s.trip);
  const storeActiveDayId = useTripStore((s) => s.activeDayId);
  const storeLeg = useTripStore((s) => s.mapVisibleLegIndex);
  const setStoreLeg = useTripStore((s) => s.setMapVisibleLegIndex);

  const trip = plannerContext?.trip ?? storeTrip;
  const activeDayId = plannerContext?.activeDayId ?? storeActiveDayId;
  const visibleLegIndex =
    plannerContext?.mapVisibleLegIndex ?? storeLeg;
  const setVisibleLegIndex =
    plannerContext?.setMapVisibleLegIndex ?? setStoreLeg;

  const activeDay = useMemo(
    () => trip.days.find((d) => d.id === activeDayId),
    [trip.days, activeDayId]
  );

  const sortedStops = useMemo(() => {
    if (!activeDay) return [];
    return [...activeDay.stops].sort((a, b) => a.order - b.order);
  }, [activeDay]);

  const nLegs = useMemo(
    () =>
      activeDay ? expectedRouteLegCount(activeDay, sortedStops) : 0,
    [activeDay, sortedStops]
  );

  const chipWrap = "flex flex-wrap gap-1.5 pt-1";
  const chipBase =
    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors";
  const chipIdle =
    "border-border/70 bg-background/80 text-muted-foreground hover:bg-muted/50";
  const chipOn =
    "border-primary/50 bg-primary/12 text-foreground ring-1 ring-primary/25";

  const chips = (
    <>
      <button
        type="button"
        className={cn(chipBase, visibleLegIndex == null ? chipOn : chipIdle)}
        aria-pressed={visibleLegIndex == null}
        onClick={() => setVisibleLegIndex(null)}
      >
        Alle
      </button>
      {Array.from({ length: nLegs }, (_, i) => (
        <button
          key={i}
          type="button"
          className={cn(
            chipBase,
            visibleLegIndex === i ? chipOn : chipIdle
          )}
          aria-pressed={visibleLegIndex === i}
          onClick={() => setVisibleLegIndex(i)}
        >
          {i + 1}
        </button>
      ))}
    </>
  );

  if (sortedStops.length < 2 || nLegs === 0) {
    const emptyText =
      "Mindestens zwei Stopps und eine berechnete Route — dann kannst du einzelne Teilstrecken auf der Karte hervorheben.";
    if (variant === "sheetChips") {
      return (
        <div className={cn("space-y-2 px-1", className)}>
          <p className="font-medium text-foreground text-xs">Teilstrecken</p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {emptyText}
          </p>
        </div>
      );
    }
    return (
      <div
        className={cn(
          "pointer-events-auto max-w-[min(calc(100vw-3.75rem),18rem)] rounded-xl border border-border/80 bg-background/90 px-3 py-2 text-muted-foreground text-xs shadow-sm backdrop-blur-md md:max-w-[280px]",
          className
        )}
      >
        <p className="leading-snug">
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <Flag className="size-3.5 shrink-0 opacity-80" aria-hidden />
            Teilstrecken
          </span>
          <span className="mt-1 block">{emptyText}</span>
        </p>
      </div>
    );
  }

  if (variant === "sheetChips") {
    return (
      <div className={cn("space-y-2 px-1", className)}>
        <p className="font-medium text-foreground text-xs">Teilstrecken</p>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Eine Nummer wählen, um nur diese Teilstrecke auf der Karte zu zeigen.
        </p>
        <div className={chipWrap}>{chips}</div>
      </div>
    );
  }

  return (
    <details
      className={cn(shell, className)}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-start gap-2 px-3 py-2 select-none",
          "hover:bg-muted/30"
        )}
        aria-label="Teilstrecken ein- oder ausklappen"
      >
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          )}
          aria-hidden
        />
        <Flag
          className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-85"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-medium text-foreground text-xs leading-tight">
            Teilstrecken
            {activeDay?.label ? (
              <span className="font-normal text-muted-foreground">
                {" "}
                · {activeDay.label}
              </span>
            ) : null}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {visibleLegIndex == null
              ? "Alle Segmente auf der Karte"
              : `Nur Segment ${visibleLegIndex + 1} von ${nLegs}`}
          </p>
        </div>
      </summary>
      <div
        className="border-border/50 border-t px-3 pb-3 pt-1"
        aria-live="polite"
      >
        <div className={chipWrap}>{chips}</div>
      </div>
    </details>
  );
}
