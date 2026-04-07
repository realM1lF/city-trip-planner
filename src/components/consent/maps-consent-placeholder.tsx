"use client";

import Link from "next/link";
import { openKlaroModal } from "@/components/consent/klaro-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MapsConsentPlaceholder() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="max-w-md text-muted-foreground text-sm">
        Die interaktive Karte wird über{" "}
        <strong className="text-foreground">Google Maps</strong> geladen. Dafür
        benötigen wir deine Einwilligung in den Privatsphäre-Einstellungen.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={() => openKlaroModal()}>
          Einstellungen öffnen
        </Button>
        <Link
          href="/datenschutz"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Datenschutz
        </Link>
      </div>
    </div>
  );
}
