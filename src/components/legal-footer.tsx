"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { openKlaroModal } from "@/components/consent/klaro-provider";
import { cn } from "@/lib/utils";

export function LegalFooter({ className }: { className?: string }) {
  const pathname = usePathname();
  const isShare = (pathname ?? "").startsWith("/share/");

  return (
    <footer
      className={cn(
        "pointer-events-none fixed z-[55] px-2",
        "left-3 max-md:right-auto max-md:translate-x-0 md:left-1/2 md:-translate-x-1/2",
        /* Geteilte Karte: Platz für Tag-Leiste + Tagesablauf unten — sonst überdeckt der Footer Bedienelemente */
        isShare
          ? "bottom-[max(4.75rem,calc(env(safe-area-inset-bottom,0px)+3.5rem))]"
          : "bottom-3",
        className
      )}
    >
      <nav
        className="pointer-events-auto flex max-w-[calc(100vw-1rem)] flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-border/80 bg-background/90 px-3 py-1.5 text-xs shadow-sm backdrop-blur-md"
        aria-label="Rechtliche Hinweise und Cookies"
      >
        <Link
          href="/impressum"
          className="text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          Impressum
        </Link>
        <span className="text-border" aria-hidden>
          ·
        </span>
        <Link
          href="/datenschutz"
          className="text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          Datenschutz
        </Link>
        <span className="text-border" aria-hidden>
          ·
        </span>
        <button
          type="button"
          className="text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          onClick={() => openKlaroModal()}
        >
          Cookies
        </button>
      </nav>
    </footer>
  );
}
