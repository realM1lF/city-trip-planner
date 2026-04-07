/** Reagiert auf Klicks auf die Kartenfläche (React-Map `onClick`), unabhängig von nativen `map.addListener`-Details. */

const listeners = new Set<() => void>();

export function notifyMapBackgroundClick(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

export function subscribeMapBackgroundClick(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
