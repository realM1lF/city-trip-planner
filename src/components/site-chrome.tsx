"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlanLiveNowHere } from "@/components/planner/PlanLiveNowHere";
import { PlanDayWeather } from "@/components/planner/PlanDayWeather";
import { PlannerAuthBar } from "@/components/planner/PlannerAuthBar";
import { cn } from "@/lib/utils";

export function SiteChrome() {
  const pathname = usePathname();
  const isShare = pathname?.startsWith("/share/");

  if (isShare) {
    return (
      <div
        className={cn(
          "pointer-events-auto fixed top-4 z-[60] max-w-[calc(100vw-2rem)] md:right-4",
          "max-md:right-14 max-md:max-w-[min(calc(100vw-3.75rem),18rem)]",
          "rounded-xl border border-border/80 bg-background/95 px-3 py-2 text-sm shadow-sm backdrop-blur-md"
        )}
      >
        <span className="text-muted-foreground">Nur Lesen · </span>
        <Link href="/" className="text-primary underline underline-offset-2">
          Zum Planner
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed top-4 z-[60] max-w-[calc(100vw-2rem)] md:right-4",
        "max-md:right-14 max-md:max-w-[min(calc(100vw-3.75rem),18rem)]",
        "flex flex-col items-end gap-2"
      )}
    >
      <PlannerAuthBar />
      <PlanLiveNowHere />
      <PlanDayWeather />
    </div>
  );
}
