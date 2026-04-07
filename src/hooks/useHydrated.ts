"use client";

import { useEffect, useState } from "react";

/** Erst nach Mount true — verhindert SSR/Client-Mismatch bei `usePathname()` o. Ä. */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
