"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  CloudIcon,
  Loader2Icon,
  LogInIcon,
  LogOutIcon,
  Share2Icon,
  UploadIcon,
  UserRoundIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  isPersistedPlannerStateV2,
  persistedV2FromZustandBlob,
  toPersistedPlannerStateV2,
  type TripStorePersistSlice,
} from "@/lib/planner-state";
import { useTripStore } from "@/stores/tripStore";
import { cn } from "@/lib/utils";

type TripRow = { id: string; name: string; updatedAt: string };

function pickPersistSlice(
  s: ReturnType<typeof useTripStore.getState>
): TripStorePersistSlice {
  return {
    trip: s.trip,
    activeDayId: s.activeDayId,
    travelMode: s.travelMode,
    optimizeWaypoints: s.optimizeWaypoints,
    routeLegDurationsByDayId: s.routeLegDurationsByDayId,
    multiModeLegSecondsByDayId: s.multiModeLegSecondsByDayId,
  };
}

export function PlannerAuthBar({ className }: { className?: string }) {
  const { data: session, status } = useSession();
  const cloudTripId = useTripStore((s) => s.cloudTripId);
  const setCloudTripId = useTripStore((s) => s.setCloudTripId);
  const hydrateFromCloud = useTripStore((s) => s.hydrateFromCloud);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tripsOpen, setTripsOpen] = useState(false);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripList, setTripList] = useState<TripRow[]>([]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const openTripsFromMobile = () => {
    closeMobileMenu();
    setTripsOpen(true);
  };

  const loadTripList = useCallback(async () => {
    if (status !== "authenticated") return;
    setTripsLoading(true);
    try {
      const res = await fetch("/api/trips");
      if (!res.ok) {
        toast.error("Reisen konnten nicht geladen werden.");
        return;
      }
      const data = (await res.json()) as { trips?: TripRow[] };
      setTripList(data.trips ?? []);
    } finally {
      setTripsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (tripsOpen && status === "authenticated") {
      void loadTripList();
    }
  }, [tripsOpen, status, loadTripList]);

  const createCloudTrip = async (opts?: { fromDevice?: boolean }) => {
    if (status !== "authenticated") return;
    let state = toPersistedPlannerStateV2(pickPersistSlice(useTripStore.getState()));
    if (opts?.fromDevice) {
      try {
        const raw = localStorage.getItem("gmapsplanner-trip");
        if (!raw) {
          toast.message("Keine lokalen Planer-Daten im Browser.");
          return;
        }
        const outer = JSON.parse(raw) as { state?: unknown };
        const fromStore = persistedV2FromZustandBlob(outer.state ?? outer);
        if (!fromStore) {
          toast.error("Lokale Daten konnten nicht gelesen werden.");
          return;
        }
        state = fromStore;
        hydrateFromCloud(fromStore);
      } catch {
        toast.error("Lokale Daten konnten nicht gelesen werden.");
        return;
      }
    }

    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: state.trip.name,
        state,
      }),
    });
    if (!res.ok) {
      toast.error("Neue Cloud-Reise konnte nicht angelegt werden.");
      return;
    }
    const data = (await res.json()) as { trip?: { id: string } };
    if (data.trip?.id) {
      setCloudTripId(data.trip.id);
      toast.success("Mit Cloud verbunden.");
      void loadTripList();
    }
  };

  const openTrip = async (id: string) => {
    setTripsOpen(false);
    const res = await fetch(`/api/trips/${id}`);
    if (!res.ok) {
      toast.error("Reise konnte nicht geladen werden.");
      return;
    }
    const data = (await res.json()) as { state?: unknown };
    if (isPersistedPlannerStateV2(data.state)) {
      setCloudTripId(id);
      hydrateFromCloud(data.state);
      toast.success("Reise geladen.");
    }
  };

  const disconnectCloud = () => {
    setCloudTripId(null);
    toast.message("Cloud-Verknüpfung entfernt (lokaler Plan bleibt).");
  };

  const copyShareLink = async () => {
    if (!cloudTripId) return;
    try {
      const res = await fetch(`/api/trips/${cloudTripId}/share`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Teilen-Link konnte nicht erstellt werden.");
        return;
      }
      const body = (await res.json()) as { shareUrl?: string };
      if (!body.shareUrl) {
        toast.error("Teilen-Link konnte nicht erstellt werden.");
        return;
      }
      await navigator.clipboard.writeText(body.shareUrl);
      toast.success("Link in die Zwischenablage kopiert.");
    } catch {
      toast.error("Link konnte nicht kopiert werden.");
    }
  };

  const revokeShare = async () => {
    if (!cloudTripId) return;
    try {
      const res = await fetch(`/api/trips/${cloudTripId}/share`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Teilen konnte nicht beendet werden.");
        return;
      }
      toast.success("Teilen beendet. Vorherige Links funktionieren nicht mehr.");
    } catch {
      toast.error("Teilen konnte nicht beendet werden.");
    }
  };

  const tripsSheet = (
    <Sheet open={tripsOpen} onOpenChange={setTripsOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Meine Reisen</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-2">
          {tripsLoading ? (
            <p className="text-muted-foreground text-sm">Lade …</p>
          ) : tripList.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Noch keine gespeicherten Reisen.
            </p>
          ) : (
            <ul className="max-h-[50dvh] space-y-1 overflow-y-auto">
              {tripList.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                      cloudTripId === t.id && "border-primary"
                    )}
                    onClick={() => void openTrip(t.id)}
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="mt-0.5 block text-muted-foreground text-xs">
                      {new Date(t.updatedAt).toLocaleString("de-DE")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            size="sm"
            className="mt-2 w-full"
            onClick={() => void createCloudTrip()}
          >
            Aktuellen Plan als neue Cloud-Reise
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full gap-1"
            onClick={() => void createCloudTrip({ fromDevice: true })}
          >
            <UploadIcon className="size-3.5" />
            Geräte-Stand in Cloud anlegen
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <>
      <div className={cn("pointer-events-auto md:hidden", className)}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            "gap-1.5 border-neutral-300/90 bg-white/90 text-neutral-900 shadow-md backdrop-blur-md",
            "hover:bg-white hover:text-neutral-900",
            "[&_svg]:text-neutral-900 dark:border-neutral-300/90 dark:bg-white/90 dark:text-neutral-900 dark:hover:bg-white dark:hover:text-neutral-900"
          )}
          onClick={() => setMobileMenuOpen(true)}
          aria-expanded={mobileMenuOpen}
          aria-haspopup="dialog"
        >
          {status === "loading" ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              <span className="sr-only">Sitzung wird geladen</span>
            </>
          ) : status === "authenticated" ? (
            <>
              <UserRoundIcon className="size-4 shrink-0" aria-hidden />
              <span className="max-w-[7rem] truncate">Konto</span>
            </>
          ) : (
            <>
              <LogInIcon className="size-4 shrink-0" aria-hidden />
              Anmelden
            </>
          )}
        </Button>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent
            side="right"
            className="flex w-full max-w-md flex-col gap-0 sm:max-w-md"
          >
            <SheetHeader className="text-left">
              <SheetTitle>Konto &amp; Cloud</SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              {status === "loading" ? (
                <p className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2Icon className="size-4 animate-spin" />
                  Sitzung wird geladen …
                </p>
              ) : status === "authenticated" ? (
                <>
                  <p
                    className="break-all text-muted-foreground text-sm"
                    title={session.user?.email ?? ""}
                  >
                    <span className="font-medium text-foreground">
                      {session.user?.name ?? "Angemeldet"}
                    </span>
                    {session.user?.email ? (
                      <>
                        <br />
                        {session.user.email}
                      </>
                    ) : null}
                  </p>
                  <Button
                    type="button"
                    className="w-full gap-2"
                    variant="outline"
                    onClick={() => openTripsFromMobile()}
                  >
                    <CloudIcon className="size-4" />
                    Reisen verwalten
                  </Button>
                  {cloudTripId ? (
                    <>
                      <Button
                        type="button"
                        className="w-full gap-2"
                        variant="outline"
                        onClick={() => void copyShareLink()}
                      >
                        <Share2Icon className="size-4" />
                        Teilen (Link kopieren)
                      </Button>
                      <Button
                        type="button"
                        className="w-full"
                        variant="secondary"
                        onClick={() => void revokeShare()}
                      >
                        Teilen beenden
                      </Button>
                      <Button
                        type="button"
                        className="w-full"
                        variant="ghost"
                        onClick={disconnectCloud}
                      >
                        Cloud trennen
                      </Button>
                    </>
                  ) : null}
                  <Button
                    type="button"
                    className="mt-auto w-full gap-2 text-muted-foreground"
                    variant="ghost"
                    onClick={() => {
                      closeMobileMenu();
                      void signOut();
                    }}
                  >
                    <LogOutIcon className="size-4" />
                    Abmelden
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm">
                    Melde dich mit Google an, um Reisen in der Cloud zu speichern
                    und zu teilen.
                  </p>
                  <Button
                    type="button"
                    className="w-full gap-2"
                    onClick={() => void signIn("google")}
                  >
                    <LogInIcon className="size-4" />
                    Mit Google anmelden
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div
        className={cn(
          "pointer-events-auto hidden flex-wrap items-center justify-end gap-2 rounded-xl border border-border/80 bg-background/90 px-2 py-1.5 text-sm shadow-sm backdrop-blur-md md:flex",
          className
        )}
      >
        {status === "loading" ? (
          <span className="flex items-center gap-1.5 px-2 text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Sitzung …
          </span>
        ) : status === "authenticated" ? (
          <>
            <span
              className="max-w-[140px] truncate px-1 text-muted-foreground md:max-w-[200px]"
              title={session.user?.email ?? ""}
            >
              {session.user?.name ?? session.user?.email ?? "Angemeldet"}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => setTripsOpen(true)}
            >
              <CloudIcon className="size-3.5" />
              Reisen
            </Button>
            {cloudTripId ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => void copyShareLink()}
                >
                  <Share2Icon className="size-3.5" />
                  Teilen
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => void revokeShare()}
                >
                  Teilen beenden
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={disconnectCloud}
                >
                  Cloud trennen
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1 text-muted-foreground"
              onClick={() => void signOut()}
            >
              <LogOutIcon className="size-3.5" />
              Abmelden
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            className="gap-1"
            onClick={() => void signIn("google")}
          >
            <LogInIcon className="size-3.5" />
            Mit Google anmelden
          </Button>
        )}
      </div>

      {tripsSheet}
    </>
  );
}
