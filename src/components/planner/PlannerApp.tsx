"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { APIProvider } from "@vis.gl/react-google-maps";
import { MapPinIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MapsConsentPlaceholder } from "@/components/consent/maps-consent-placeholder";
import { useKlaroMapsAllowed } from "@/components/consent/klaro-provider";
import { MapView } from "@/components/planner/MapView";
import { MissingApiKey } from "@/components/planner/MissingApiKey";
import { PlannerPanel } from "@/components/planner/PlannerPanel";
import { useCloudTripSync } from "@/hooks/useCloudTripSync";
import { useTripStore } from "@/stores/tripStore";
import { cn } from "@/lib/utils";

function CloudTripSyncRunner({ tripHydrated }: { tripHydrated: boolean }) {
  useCloudTripSync(tripHydrated);
  return null;
}

function useTripStoreHydrated() {
  /** Immer false beim ersten Render (SSR + Client), sonst Hydration-Mismatch. */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (useTripStore.persist.hasHydrated()) setHydrated(true);
    return useTripStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}

type KeyResponse = { key?: string; error?: string };

export function PlannerApp() {
  const [mobileOpen, setMobileOpen] = useState(false);
  /** Popup-Root fokussieren statt erstes Input — verhindert Tastatur beim Öffnen auf dem Handy. */
  const mobileSheetPopupRef = useRef<HTMLDivElement>(null);
  const tripHydrated = useTripStoreHydrated();
  const mapsConsent = useKlaroMapsAllowed();
  const [mapsKey, setMapsKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState(false);

  useEffect(() => {
    if (!tripHydrated) return;
    let cancelled = false;
    void fetch("/api/google-maps-key")
      .then(async (res) => {
        const data = (await res.json()) as KeyResponse;
        if (cancelled) return;
        const k = data.key?.trim();
        if (!res.ok || !k) {
          setKeyError(true);
          return;
        }
        setMapsKey(k);
      })
      .catch(() => {
        if (!cancelled) setKeyError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tripHydrated]);

  if (!tripHydrated) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background px-4 text-center text-muted-foreground text-sm">
        Gespeicherter Plan wird geladen …
      </div>
    );
  }

  const cloudSync = <CloudTripSyncRunner tripHydrated />;

  if (keyError) {
    return (
      <>
        {cloudSync}
        <MissingApiKey />
      </>
    );
  }

  if (mapsKey === null) {
    return (
      <>
        {cloudSync}
        <div className="flex h-dvh items-center justify-center bg-background px-4 text-center text-muted-foreground text-sm">
          Karte wird vorbereitet …
        </div>
      </>
    );
  }

  if (mapsConsent === null) {
    return (
      <>
        {cloudSync}
        <div className="flex h-dvh items-center justify-center bg-background px-4 text-center text-muted-foreground text-sm">
          Privatsphäre-Einstellungen werden geladen …
        </div>
      </>
    );
  }

  if (!mapsConsent) {
    return (
      <>
        {cloudSync}
        <MapsConsentPlaceholder />
      </>
    );
  }

  return (
    <APIProvider
      apiKey={mapsKey}
      onError={(err) => {
        console.error(err);
        toast.error("Google Maps konnte nicht geladen werden.");
      }}
    >
      {cloudSync}
      <div className="relative h-dvh w-full overflow-hidden bg-background md:bg-transparent">
        <div className="absolute inset-0 z-0 min-h-0">
          <MapView />
        </div>

        <aside
          className="pointer-events-none absolute top-5 bottom-5 left-5 z-30 hidden w-[min(380px,calc(100vw-2.5rem))] md:flex md:flex-col"
          aria-label="Tagesplan"
        >
          <div
            className={cn(
              "planner-glass-shell pointer-events-auto flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border backdrop-blur-xl backdrop-saturate-125"
            )}
          >
            <PlannerPanel />
          </div>
        </aside>

        <Button
          type="button"
          size="sm"
          className="fixed top-4 left-4 z-[60] gap-1.5 border border-border/80 bg-background/95 text-foreground shadow-md backdrop-blur-md hover:bg-background focus-visible:ring-ring/50 md:hidden dark:bg-background/95"
          onClick={() => setMobileOpen(true)}
        >
          <MapPinIcon className="size-4" />
          Tagesplan
        </Button>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            ref={mobileSheetPopupRef}
            side="left"
            showCloseButton
            className={cn(
              "w-full gap-0 p-0 sm:max-w-md",
              "data-[side=left]:!top-5 data-[side=left]:!bottom-5 data-[side=left]:!left-5",
              "data-[side=left]:!h-[calc(100dvh-2.5rem)] data-[side=left]:!right-auto",
              "planner-glass-shell rounded-2xl rounded-l-2xl border backdrop-blur-xl backdrop-saturate-125"
            )}
            /* Immer Panel-Container statt erstes Input — vermeidet Tastatur; gilt nur für dieses mobile Sheet. */
            initialFocus={() => mobileSheetPopupRef.current ?? false}
          >
            <SheetHeader className="shrink-0 border-b border-border/60 px-4 py-3 text-left">
              <SheetTitle className="font-heading text-base">Tagesplan</SheetTitle>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <PlannerPanel />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </APIProvider>
  );
}
