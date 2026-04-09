"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { computeDayItinerary, formatTimeWindow } from "@/lib/itinerary-time";
import { getLiveStopWindowStatus } from "@/lib/itinerary-live";
import { useHydrated } from "@/hooks/useHydrated";
import { useTripStore } from "@/stores/tripStore";
import type { Trip } from "@/types/trip";
import { cn } from "@/lib/utils";

export type PlanLiveNowHerePlannerContext = {
  trip: Trip;
  activeDayId: string;
  routeLegDurationsByDayId: Record<string, number[] | null | undefined>;
};

const TICK_MS = 45_000;

const shell = cn(
  "pointer-events-auto w-full max-w-[min(calc(100vw-3.75rem),18rem)] rounded-xl border border-border/80 bg-background/90 text-sm shadow-sm backdrop-blur-md md:max-w-[280px]",
  "[&_summary::-webkit-details-marker]:hidden group"
);

function GpsVsPlanHint() {
  return (
    <p className="mt-2 border-t border-border/50 pt-2 text-[10px] text-muted-foreground leading-snug">
      <strong className="font-medium text-foreground/85">Kein GPS.</strong> Hier steht nur,{" "}
      <em>
        welcher Plan‑Stopp zur <strong className="font-medium">aktuellen Uhrzeit</strong> passt
      </em>
      . Deinen echten Standort auf der Karte:{" "}
      <strong className="font-medium text-foreground/85">Fadenkreuz unten rechts</strong>{" "}
      tippen — dann fragt der Browser (Hauptseite und geteilte Karte gleich).
    </p>
  );
}

export function PlanLiveNowHere({
  className,
  plannerContext,
}: {
  className?: string;
  plannerContext?: PlanLiveNowHerePlannerContext;
}) {
  const hydrated = useHydrated();
  const pathname = usePathname();
  const storeTrip = useTripStore((s) => s.trip);
  const storeActiveDayId = useTripStore((s) => s.activeDayId);
  const storeRouteLegs = useTripStore((s) => s.routeLegDurationsByDayId);
  const trip = plannerContext?.trip ?? storeTrip;
  const activeDayId = plannerContext?.activeDayId ?? storeActiveDayId;
  const legSeconds =
    plannerContext != null
      ? plannerContext.routeLegDurationsByDayId[activeDayId]
      : storeRouteLegs[activeDayId];
  const allowUi =
    plannerContext != null || (pathname ?? "") === "/";

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!allowUi) return;
    const id = window.setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [allowUi]);

  const activeDay = useMemo(
    () => trip.days.find((d) => d.id === activeDayId),
    [trip.days, activeDayId]
  );

  const sortedStops = useMemo(() => {
    if (!activeDay) return [];
    return [...activeDay.stops].sort((a, b) => a.order - b.order);
  }, [activeDay]);

  const computed = useMemo(
    () =>
      activeDay
        ? computeDayItinerary(sortedStops, legSeconds ?? undefined, activeDay)
        : computeDayItinerary(sortedStops, legSeconds ?? undefined),
    [sortedStops, legSeconds, activeDay]
  );

  const live = useMemo(() => {
    return getLiveStopWindowStatus({
      planDayDate: activeDay?.date ?? null,
      sortedStops,
      itinerary: computed.ok ? computed.itinerary : null,
      day: activeDay,
      now: new Date(nowMs),
    });
  }, [activeDay, sortedStops, computed, activeDayId, nowMs]);

  const stopById = useMemo(() => {
    const m = new Map(sortedStops.map((s) => [s.id, s]));
    return (id: string) => m.get(id)?.label ?? "Stopp";
  }, [sortedStops]);

  const windowForStop = useMemo(() => {
    if (!computed.ok) return () => null as string | null;
    const rows = computed.itinerary.stops;
    return (stopId: string) => {
      const row = rows.find((s) => s.stopId === stopId);
      if (!row) return null;
      return formatTimeWindow(row.arrivalTotalMin, row.departureTotalMin);
    };
  }, [computed]);

  if (!hydrated || !allowUi) return null;

  let summaryTitle = "Zeitplan live";
  let summaryLine = "";
  let detailBody: ReactNode = null;
  let glow = false;

  if (live.kind === "noPlan") {
    summaryLine = "Kalendertag oder Route fehlt";
    detailBody = (
      <>
        <p className="text-muted-foreground text-xs leading-snug">
          Kalendertag setzen und Route laden — dann siehst du hier, welcher
          Stopp zur Uhrzeit passt (nur wenn der Plan‑Kalendertag{" "}
          <strong className="font-medium text-foreground/90">heute</strong> ist;
          Vergleich in Zeitzone Europe/Berlin wie beim Wetter).
        </p>
        <GpsVsPlanHint />
      </>
    );
  } else if (live.kind === "noToday") {
    summaryLine = "Anderer Plan‑Tag als heute";
    detailBody = (
      <>
        <p className="text-muted-foreground text-xs leading-snug">
          Der gewählte Tag im Planner ist nicht der heutige Kalendertag
          (Vergleich in <strong className="font-medium text-foreground/90">Europe/Berlin</strong>).
          Das ist nur der Kalender —{" "}
          <strong className="font-medium text-foreground/90">nicht</strong> dein GPS‑Standort.
          Live‑Hinweise hier nur sinnvoll, wenn du den Tag auf heute stellst.
        </p>
        <GpsVsPlanHint />
      </>
    );
  } else if (live.kind === "atStop") {
    glow = true;
    summaryTitle = "Gerade (laut Uhr)";
    const win = windowForStop(live.stopId);
    summaryLine = `${stopById(live.stopId)}${win ? ` · ${win}` : ""}`;
    detailBody = (
      <>
        <p className="text-foreground/90 text-xs leading-snug">{summaryLine}</p>
        <GpsVsPlanHint />
      </>
    );
  } else if (live.kind === "inTransit") {
    summaryTitle = "Unterwegs (laut Uhr)";
    summaryLine = `„${stopById(live.fromStopId)}“ → „${stopById(live.toStopId)}“`;
    detailBody = (
      <>
        <p className="text-foreground/90 text-xs leading-snug">{summaryLine}</p>
        <GpsVsPlanHint />
      </>
    );
  } else if (live.kind === "before") {
    summaryTitle = "Als Nächstes";
    const win = windowForStop(live.nextStopId);
    summaryLine = `${stopById(live.nextStopId)}${win ? ` · ${win}` : ""}`;
    detailBody = (
      <>
        <p className="text-foreground/90 text-xs leading-snug">{summaryLine}</p>
        <GpsVsPlanHint />
      </>
    );
  } else {
    summaryTitle = "Nach Plan (Uhr)";
    summaryLine = `Letztes Segment — „${stopById(live.lastStopId)}“`;
    detailBody = (
      <>
        <p className="text-muted-foreground text-xs leading-snug">
          Letztes Segment beendet — Ziel zuletzt „{stopById(live.lastStopId)}“.
        </p>
        <GpsVsPlanHint />
      </>
    );
  }

  return (
    <details
      className={cn(
        shell,
        "transition-[box-shadow,ring-color] duration-300",
        glow &&
          "shadow-md ring-2 ring-primary/35 animate-pulse [animation-duration:3.5s]",
        className
      )}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-start gap-2 px-3 py-2 select-none",
          "hover:bg-muted/30"
        )}
        aria-label="Zeitplan live ein- oder ausklappen"
      >
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          )}
          aria-hidden
        />
        <Clock
          className={cn(
            "mt-0.5 size-4 shrink-0 opacity-80",
            glow ? "text-primary" : "text-muted-foreground"
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-medium text-foreground text-xs leading-tight">
            {summaryTitle}
            {activeDay?.label ? (
              <span className="font-normal text-muted-foreground">
                {" "}
                · {activeDay.label}
              </span>
            ) : null}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {summaryLine}
          </p>
        </div>
      </summary>
      <div
        className="border-border/50 border-t px-3 pb-3 pt-1"
        aria-live="polite"
      >
        {detailBody}
      </div>
    </details>
  );
}
