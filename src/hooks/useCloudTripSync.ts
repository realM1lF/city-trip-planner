"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  isPersistedPlannerStateV2,
  toPersistedPlannerStateV2,
  type TripStorePersistSlice,
} from "@/lib/planner-state";
import { useTripStore } from "@/stores/tripStore";

function pickPersistSlice(s: ReturnType<typeof useTripStore.getState>): TripStorePersistSlice {
  return {
    trip: s.trip,
    activeDayId: s.activeDayId,
    travelMode: s.travelMode,
    optimizeWaypoints: s.optimizeWaypoints,
    routeLegDurationsByDayId: s.routeLegDurationsByDayId,
    multiModeLegSecondsByDayId: s.multiModeLegSecondsByDayId,
  };
}

/**
 * Nach Login: Cloud-Trip einmal vom Server laden.
 * Bei geändertem Store: debounced PATCH zur API.
 */
export function useCloudTripSync(tripHydrated: boolean) {
  const { data: session, status } = useSession();
  const cloudTripId = useTripStore((s) => s.cloudTripId);
  const hydrateFromCloud = useTripStore((s) => s.hydrateFromCloud);
  const loadedServerForId = useRef<string | null>(null);

  useEffect(() => {
    if (
      !tripHydrated ||
      status !== "authenticated" ||
      !session?.user?.id ||
      !cloudTripId
    ) {
      return;
    }
    if (loadedServerForId.current === cloudTripId) {
      return;
    }
    loadedServerForId.current = cloudTripId;
    let cancelled = false;
    void fetch(`/api/trips/${cloudTripId}`)
      .then(async (res) => {
        if (!res.ok) {
          loadedServerForId.current = null;
          if (res.status === 404) {
            useTripStore.getState().setCloudTripId(null);
            toast.message(
              "Cloud-Reise nicht mehr verfügbar. Nur noch lokale Kopie."
            );
          }
          return;
        }
        const data = (await res.json()) as { state?: unknown };
        if (cancelled || !isPersistedPlannerStateV2(data.state)) return;
        hydrateFromCloud(data.state);
      })
      .catch(() => {
        loadedServerForId.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [
    tripHydrated,
    status,
    session?.user?.id,
    cloudTripId,
    hydrateFromCloud,
  ]);

  /** Bei jeder Änderung der Cloud-ID neu laden können; bei `null` Ref nicht auf alte ID hängen lassen. */
  useEffect(() => {
    loadedServerForId.current = null;
  }, [cloudTripId]);

  useEffect(() => {
    if (
      !tripHydrated ||
      status !== "authenticated" ||
      !session?.user?.id ||
      !cloudTripId
    ) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const st = useTripStore.getState();
        const body = {
          name: st.trip.name,
          state: toPersistedPlannerStateV2(pickPersistSlice(st)),
        };
        try {
          const res = await fetch(`/api/trips/${cloudTripId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            toast.error("Cloud-Speichern fehlgeschlagen.");
          }
        } catch {
          toast.error("Cloud-Speichern fehlgeschlagen.");
        }
      }, 1500);
    };

    const unsub = useTripStore.subscribe(schedule);
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [tripHydrated, status, session?.user?.id, cloudTripId]);
}
