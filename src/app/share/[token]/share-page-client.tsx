"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { APIProvider } from "@vis.gl/react-google-maps";
import { toast } from "sonner";
import { MissingApiKey } from "@/components/planner/MissingApiKey";
import { ShareMapView } from "@/components/planner/ShareMapView";
import { isPersistedPlannerStateV2 } from "@/lib/planner-state";
import type { PersistedPlannerStateV2 } from "@/types/trip";

type KeyResponse = { key?: string; error?: string };

type ShareApiOk = { name: string; state: unknown };

export function SharePageClient({ token }: { token: string }) {
  const [mapsKey, setMapsKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState(false);
  const [data, setData] = useState<ShareApiOk | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/google-maps-key")
      .then(async (res) => {
        const j = (await res.json()) as KeyResponse;
        if (cancelled) return;
        const k = j.key?.trim();
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
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/share/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setLoadError(true);
          return;
        }
        const j = (await res.json()) as ShareApiOk;
        if (cancelled) return;
        if (!isPersistedPlannerStateV2(j.state)) {
          setLoadError(true);
          return;
        }
        setData({ name: j.name, state: j.state });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loadError || (data && !isPersistedPlannerStateV2(data.state))) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="text-muted-foreground">
          Dieser Link ist ungültig oder wurde deaktiviert.
        </p>
        <Link href="/" className="text-primary underline">
          Zum Planner
        </Link>
      </div>
    );
  }

  if (!data || !isPersistedPlannerStateV2(data.state)) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background text-muted-foreground text-sm">
        Geteilte Reise wird geladen …
      </div>
    );
  }

  if (keyError) {
    return <MissingApiKey />;
  }

  if (mapsKey === null) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background text-muted-foreground text-sm">
        Karte wird vorbereitet …
      </div>
    );
  }

  const persisted = data.state as PersistedPlannerStateV2;

  return (
    <APIProvider
      apiKey={mapsKey}
      onError={(err) => {
        console.error(err);
        toast.error("Google Maps konnte nicht geladen werden.");
      }}
    >
      <div className="flex h-dvh flex-col bg-background">
        <header className="shrink-0 border-b border-border px-4 py-3">
          <h1 className="font-heading font-semibold text-base">{data.name}</h1>
          <p className="text-muted-foreground text-xs">
            Nur Ansicht – gemeinsam geteilt.
          </p>
        </header>
        <div className="min-h-0 flex-1">
          <ShareMapView persisted={persisted} />
        </div>
      </div>
    </APIProvider>
  );
}
