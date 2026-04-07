"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  CloudIcon,
  Loader2Icon,
  LogInIcon,
  LogOutIcon,
  PlusIcon,
  Share2Icon,
  Trash2Icon,
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
  const resetTrip = useTripStore((s) => s.resetTrip);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tripsOpen, setTripsOpen] = useState(false);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripList, setTripList] = useState<TripRow[]>([]);
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null);

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
    let state = toPersistedPlannerStateV2(
      pickPersistSlice(useTripStore.getState())
    );
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

  /** Leerer Standard-Trip: zuerst Cloud trennen, damit kein PATCH die alte Reise leert. */
  const createEmptyCloudTrip = async () => {
    if (status !== "authenticated") return;
    setCloudTripId(null);
    resetTrip();
    await createCloudTrip();
  };

  const deleteCloudTrip = async (id: string, name: string) => {
    if (status !== "authenticated") return;
    const ok = window.confirm(
      `Reise „${name}“ unwiderruflich aus der Cloud löschen?`
    );
    if (!ok) return;
    setDeletingTripId(id);
    try {
      const res = await fetch(`/api/trips/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Reise konnte nicht gelöscht werden.");
        return;
      }
      if (useTripStore.getState().cloudTripId === id) {
        setCloudTripId(null);
        toast.message(
          "Reise gelöscht. Der Plan im Editor bleibt lokal; es wird nicht mehr synchronisiert."
        );
      } else {
        toast.success("Reise gelöscht.");
      }
      void loadTripList();
    } catch {
      toast.error("Reise konnte nicht gelöscht werden.");
    } finally {
      setDeletingTripId(null);
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
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-border/50 border-b px-4 pt-4 pb-4 pr-14">
          <SheetTitle>Meine Reisen</SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto px-4 pb-8">
          <p className="text-muted-foreground text-xs leading-relaxed">
            Es ist immer <strong className="font-medium text-foreground">eine</strong>{" "}
            Reise mit der Cloud verknüpft; Änderungen im Planer werden automatisch
            dorthin gespeichert. Zum Wechseln: eine andere Reise aus der Liste
            öffnen oder eine neue anlegen.
          </p>

          <section className="mt-6 space-y-3">
            <h3 className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
              Gespeicherte Reisen
            </h3>
            {tripsLoading ? (
              <p className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2Icon className="size-4 animate-spin shrink-0" />
                Lade …
              </p>
            ) : tripList.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center text-muted-foreground text-sm leading-snug">
                Noch keine gespeicherten Reisen. Unten kannst du mit{" "}
                <strong className="font-medium text-foreground">Neue Reise</strong>{" "}
                starten.
              </p>
            ) : (
              <ul className="max-h-[42dvh] space-y-2.5 overflow-y-auto pr-0.5">
                {tripList.map((t) => (
                  <li key={t.id} className="flex gap-2">
                    <button
                      type="button"
                      className={cn(
                        "min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent",
                        cloudTripId === t.id && "border-primary ring-1 ring-primary/25"
                      )}
                      onClick={() => void openTrip(t.id)}
                    >
                      <span className="font-medium">{t.name}</span>
                      <span className="mt-1 block text-muted-foreground text-xs">
                        {new Date(t.updatedAt).toLocaleString("de-DE")}
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="mt-0.5 shrink-0 self-start text-muted-foreground hover:text-destructive"
                      disabled={deletingTripId === t.id}
                      aria-label={`Reise „${t.name}“ löschen`}
                      title="Löschen"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void deleteCloudTrip(t.id, t.name);
                      }}
                    >
                      {deletingTripId === t.id ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : (
                        <Trash2Icon className="size-4" />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8 space-y-3 border-border/60 border-t pt-6">
            <h3 className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
              Neue Reise
            </h3>
            <Button
              type="button"
              className="h-10 w-full gap-2"
              onClick={() => void createEmptyCloudTrip()}
            >
              <PlusIcon className="size-4 shrink-0" aria-hidden />
              Neue Reise
            </Button>
            <p className="text-muted-foreground text-[11px] leading-snug">
              Leerer Plan, sofort als neue Cloud-Reise verbunden. Der bisherige
              Editor-Inhalt wird dabei verworfen — zuerst speichern, als zweite
              Reise, falls du ihn behalten willst.
            </p>
          </section>

          <section className="mt-6 space-y-2.5">
            <h3 className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
              Weitere Aktionen
            </h3>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-auto min-h-9 w-full justify-start whitespace-normal py-2.5 text-left"
              title="Speichert eine Kopie des aktuellen Plans unter dem gleichen Namen als zusätzliche Cloud-Reise."
              onClick={() => void createCloudTrip()}
            >
              <span className="text-balance">
                Aktuellen Plan als zweite Reise speichern
              </span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-auto min-h-9 w-full justify-start gap-2 whitespace-normal py-2.5 text-left"
              title="Lädt den zuletzt im Browser gespeicherten Stand und legt dafür eine neue Cloud-Reise an."
              onClick={() => void createCloudTrip({ fromDevice: true })}
            >
              <UploadIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="text-balance">
                Plan aus Browser-Speicher in die Cloud legen
              </span>
            </Button>
          </section>
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
