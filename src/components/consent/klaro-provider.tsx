"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ConsentManager } from "klaro";
import {
  KLARO_GOOGLE_MAPS_SERVICE,
  klaroConfig,
} from "@/lib/klaro/config";

type MapsAllowed = boolean | null;

const KlaroMapsContext = createContext<MapsAllowed>(null);

function computeMapsAllowed(manager: ConsentManager): boolean {
  return (
    manager.getConsent(KLARO_GOOGLE_MAPS_SERVICE) && manager.confirmed
  );
}

export function KlaroProvider({ children }: { children: React.ReactNode }) {
  const [mapsAllowed, setMapsAllowed] = useState<MapsAllowed>(null);

  useEffect(() => {
    const watcher = {
      update(manager: ConsentManager, name: string) {
        if (
          name !== "consents" &&
          name !== "saveConsents" &&
          name !== "applyConsents"
        ) {
          return;
        }
        setMapsAllowed(computeMapsAllowed(manager));
      },
    };

    let manager: ConsentManager | null = null;
    let cancelled = false;

    void import("klaro").then((klaro) => {
      if (cancelled) return;
      manager = klaro.getManager(klaroConfig);
      manager.watch(watcher);
      setMapsAllowed(computeMapsAllowed(manager));
      /* Ohne show: true — sonst bleibt die Notice immer an (Klaro: show = showCnt > 0 || !confirmed). */
      klaro.render(klaroConfig, {});
    });

    return () => {
      cancelled = true;
      if (manager) {
        manager.unwatch(watcher);
      }
    };
  }, []);

  const value = useMemo(() => mapsAllowed, [mapsAllowed]);

  return (
    <KlaroMapsContext.Provider value={value}>
      {children}
    </KlaroMapsContext.Provider>
  );
}

export function useKlaroMapsAllowed(): MapsAllowed {
  return useContext(KlaroMapsContext);
}

export function openKlaroModal(): void {
  void import("klaro").then((klaro) => {
    klaro.render(klaroConfig, { show: true, modal: true });
  });
}
