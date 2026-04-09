"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Clock, CloudSun } from "lucide-react";
import { PlanLiveNowHere } from "@/components/planner/PlanLiveNowHere";
import { PlanDayWeather } from "@/components/planner/PlanDayWeather";
import { PlannerAuthBar } from "@/components/planner/PlannerAuthBar";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/useHydrated";
import { cn } from "@/lib/utils";

/**
 * Desktop: Live + Wetter erst nach Mount — aus SSR raus, damit Hydration nicht
 * mit usePathname / Uhr / persist-Store im ersten Client-Pass kollidiert.
 */
function DesktopPlannerInsights() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return (
    <div className="hidden w-full flex-col items-end gap-2 md:flex">
      {mounted ? (
        <>
          <PlanLiveNowHere />
          <PlanDayWeather />
        </>
      ) : null}
    </div>
  );
}

/** Mobil: kompakte Icon-Leiste rechts; Karteninhalt bleibt frei. */
function MobilePlannerInsightsRail() {
  const hydrated = useHydrated();
  const pathname = usePathname();
  const [open, setOpen] = useState<null | "live" | "weather">(null);

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!hydrated || pathname !== "/") return null;

  return (
    <>
      {open != null ? (
        <button
          type="button"
          className="fixed inset-0 z-[58] bg-black/25 backdrop-blur-[1px] md:hidden"
          aria-label="Infofenster schließen"
          onClick={() => setOpen(null)}
        />
      ) : null}

      {open != null ? (
        <div
          className="fixed top-[6.75rem] z-[59] max-h-[min(75dvh,calc(100dvh-7rem))] w-[min(calc(100vw-5.5rem),20rem)] overflow-y-auto overflow-x-hidden rounded-xl border border-border/80 bg-background/95 shadow-lg backdrop-blur-md md:hidden right-[4.25rem]"
          role="dialog"
          aria-modal="true"
          aria-label={open === "live" ? "Zeitplan live" : "Wetter"}
        >
          {open === "live" ? (
            <PlanLiveNowHere className="!max-w-none w-full border-0 bg-transparent shadow-none" />
          ) : (
            <PlanDayWeather className="!max-w-none w-full border-0 bg-transparent shadow-none" />
          )}
        </div>
      ) : null}

      <div className="pointer-events-auto fixed top-[6.75rem] right-3 z-[61] flex flex-col gap-2 md:hidden">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className={cn(
            "h-11 w-11 rounded-full border border-border/80 shadow-md",
            open === "live" && "ring-2 ring-primary/45"
          )}
          title="Zeitplan live"
          aria-label="Zeitplan live öffnen"
          aria-expanded={open === "live"}
          onClick={() => setOpen((o) => (o === "live" ? null : "live"))}
        >
          <Clock className="size-5" aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className={cn(
            "h-11 w-11 rounded-full border border-border/80 shadow-md",
            open === "weather" && "ring-2 ring-primary/45"
          )}
          title="Wetter"
          aria-label="Wetter öffnen"
          aria-expanded={open === "weather"}
          onClick={() => setOpen((o) => (o === "weather" ? null : "weather"))}
        >
          <CloudSun className="size-5" aria-hidden />
        </Button>
      </div>
    </>
  );
}

export function SiteChrome() {
  const pathname = usePathname();
  const isShare = (pathname ?? "").startsWith("/share/");

  if (isShare) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "pointer-events-none fixed top-4 z-[60] max-w-[calc(100vw-2rem)] md:right-4",
          "max-md:right-14 max-md:max-w-[min(calc(100vw-3.75rem),18rem)]",
          "flex flex-col items-end gap-2"
        )}
      >
        <PlannerAuthBar />
        <DesktopPlannerInsights />
      </div>
      <MobilePlannerInsightsRail />
    </>
  );
}
