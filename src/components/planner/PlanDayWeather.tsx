"use client";

import {
  ChevronDown,
  Cloud,
  CloudFog,
  CloudRain,
  CloudSnow,
  CloudSun,
  Loader2Icon,
  Sun,
  Zap,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  berlinCalendarDateISO,
  weatherCodeSummaryDe,
  type DayWeatherSnapshot,
} from "@/lib/open-meteo";
import { useTripStore } from "@/stores/tripStore";
import type { TripStop } from "@/types/trip";
import { cn } from "@/lib/utils";

function centroid(stops: TripStop[]): { lat: number; lng: number } | null {
  if (stops.length === 0) return null;
  let lat = 0;
  let lng = 0;
  for (const s of stops) {
    lat += s.lat;
    lng += s.lng;
  }
  return { lat: lat / stops.length, lng: lng / stops.length };
}

function WeatherGlyph({ code, className }: { code: number; className?: string }) {
  const c = cn("size-7 shrink-0", className);
  if (code === 0 || code === 1) return <Sun className={c} aria-hidden />;
  if (code === 2) return <CloudSun className={c} aria-hidden />;
  if (code === 3) return <Cloud className={c} aria-hidden />;
  if (code === 45 || code === 48) return <CloudFog className={c} aria-hidden />;
  if (code >= 71 && code <= 77) return <CloudSnow className={c} aria-hidden />;
  if (code >= 95 && code <= 99) return <Zap className={c} aria-hidden />;
  if (code >= 51) return <CloudRain className={c} aria-hidden />;
  return <CloudSun className={c} aria-hidden />;
}

function summarySecondLine(opts: {
  phase: "idle" | "loading" | "ok" | "empty" | "err";
  data: DayWeatherSnapshot | null;
  isPast: boolean;
  errorDetail: string | null;
}): string {
  const { phase, data, isPast, errorDetail } = opts;
  if (phase === "loading" || phase === "idle") return "Lade Wetter …";
  if (phase === "err") {
    return errorDetail?.trim()
      ? `Fehler — ${errorDetail}`
      : "Abruf fehlgeschlagen — aufklappen für mehr.";
  }
  if (phase === "ok" && data) {
    const t = `${Math.round(data.tempMin)}° / ${Math.round(data.tempMax)}°C`;
    const w = weatherCodeSummaryDe(data.weatherCode);
    let extra = "";
    if (!isPast && data.precipChanceMax != null && data.precipChanceMax > 0) {
      extra = ` · Regen bis ca. ${Math.round(data.precipChanceMax)} %`;
    }
    return `${t} · ${w}${extra}`;
  }
  return "Aufklappen für Details …";
}

export function PlanDayWeather({ className }: { className?: string }) {
  const pathname = usePathname();
  const trip = useTripStore((s) => s.trip);
  const activeDayId = useTripStore((s) => s.activeDayId);

  const activeDay = useMemo(
    () => trip.days.find((d) => d.id === activeDayId),
    [trip.days, activeDayId]
  );

  const sortedStops = useMemo(() => {
    if (!activeDay) return [];
    return [...activeDay.stops].sort((a, b) => a.order - b.order);
  }, [activeDay]);

  const dateISO = activeDay?.date?.trim() || null;

  const center = useMemo(() => centroid(sortedStops), [sortedStops]);

  const dateLabel = useMemo(() => {
    if (!dateISO) return "";
    try {
      return new Date(`${dateISO}T12:00:00`).toLocaleDateString("de-DE", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    } catch {
      return dateISO;
    }
  }, [dateISO]);

  const [data, setData] = useState<DayWeatherSnapshot | null>(null);
  const [phase, setPhase] = useState<
    "idle" | "loading" | "ok" | "empty" | "err"
  >("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    if (pathname !== "/") return;

    if (!dateISO || !center) {
      setData(null);
      setErrorDetail(null);
      setPhase("empty");
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPhase("loading");
      setErrorDetail(null);
      void (async () => {
        try {
          const params = new URLSearchParams({
            lat: String(center.lat),
            lng: String(center.lng),
            date: dateISO,
          });
          const res = await fetch(`/api/weather-day?${params.toString()}`, {
            cache: "no-store",
          });
          const body = (await res.json()) as {
            snapshot?: DayWeatherSnapshot | null;
            error?: string;
          };
          if (cancelled) return;
          if (!res.ok) {
            setData(null);
            setErrorDetail(body.error ?? `HTTP ${res.status}`);
            setPhase("err");
            return;
          }
          if (!body.snapshot) {
            setData(null);
            setPhase("empty");
            return;
          }
          setData(body.snapshot);
          setPhase("ok");
        } catch (e) {
          if (cancelled) return;
          setData(null);
          setErrorDetail(e instanceof Error ? e.message : "Netzwerkfehler");
          setPhase("err");
        }
      })();
    }, 380);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pathname, dateISO, center?.lat, center?.lng]);

  if (pathname !== "/") return null;

  const today = berlinCalendarDateISO();
  const isPast = dateISO != null && dateISO < today;

  if (!dateISO || sortedStops.length === 0) {
    return (
      <div
        className={cn(
          "pointer-events-auto max-w-[min(calc(100vw-3.75rem),18rem)] rounded-xl border border-border/80 bg-background/90 px-3 py-2 text-muted-foreground text-xs shadow-sm backdrop-blur-md md:max-w-[220px]",
          className
        )}
      >
        <p className="leading-snug">
          <span className="font-medium text-foreground">Wetter</span>
          <span className="mt-1 block">
            Datum für den Tag setzen und Stopps eintragen — dann erscheint die
            Vorhersage für die Route.
          </span>
        </p>
      </div>
    );
  }

  const sub = summarySecondLine({ phase, data, isPast, errorDetail });

  return (
    <details
      className={cn(
        "pointer-events-auto w-full max-w-[min(calc(100vw-3.75rem),18rem)] rounded-xl border border-border/80 bg-background/90 text-sm shadow-sm backdrop-blur-md md:max-w-[280px]",
        "[&_summary::-webkit-details-marker]:hidden group",
        className
      )}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-start gap-2 px-3 py-2 select-none",
          "hover:bg-muted/30"
        )}
        aria-label="Wetter ein- oder ausklappen"
      >
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          )}
          aria-hidden
        />
        {phase === "loading" || phase === "idle" ? (
          <Loader2Icon
            className="size-7 shrink-0 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : phase === "ok" && data ? (
          <WeatherGlyph code={data.weatherCode} className="text-primary" />
        ) : (
          <CloudSun
            className="size-7 shrink-0 text-muted-foreground opacity-70"
            aria-hidden
          />
        )}
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-medium text-foreground text-xs leading-tight">
            Wetter · {activeDay?.label ?? "Tag"}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">{sub}</p>
        </div>
      </summary>

      <div
        className="border-t border-border/50 px-3 pb-3 pt-0.5 text-xs leading-relaxed"
        aria-live="polite"
      >
        <p className="text-[11px] text-muted-foreground">
          Kalendertag: {dateLabel}
          {isPast ? " (archivierte Messwerte)" : " (Vorhersage)"}
        </p>

        {phase === "loading" || phase === "idle" ? (
          <p className="mt-2 text-muted-foreground">Daten werden geladen …</p>
        ) : phase === "ok" && data ? (
          <div className="mt-2 space-y-2">
            <p className="font-semibold tabular-nums text-foreground">
              {Math.round(data.tempMin)}° / {Math.round(data.tempMax)}°C
            </p>
            <p className="text-muted-foreground">
              {weatherCodeSummaryDe(data.weatherCode)}
            </p>
            {!isPast &&
            data.precipChanceMax != null &&
            data.precipChanceMax > 0 ? (
              <p className="text-muted-foreground">
                Regenwahrscheinlichkeit (Tagesmaximum): bis ca.{" "}
                {Math.round(data.precipChanceMax)}&nbsp;%
              </p>
            ) : null}
          </div>
        ) : phase === "err" ? (
          <div className="mt-2 space-y-1 text-muted-foreground">
            <p>Der Wetterdienst hat keine nutzbaren Daten geliefert.</p>
            {errorDetail ? (
              <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-destructive text-[11px] dark:text-red-300">
                {errorDetail}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-muted-foreground">
            Für dieses Datum liefert der Dienst gerade keinen Wert — bei
            Vorhersage oft nur etwa 16&nbsp;Tage im Voraus, oder der Dienst ist
            kurz nicht erreichbar.
          </p>
        )}

        <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground/90">Ablauf am Tag</p>
          <p className="mt-1 leading-snug">
            Es wird <strong className="font-medium text-foreground">ein</strong>{" "}
            Tageswert für den Mittelpunkt deiner Stopps geschätzt — nicht
            stundenweise entlang der Route. Für genauere Aussagen zu einzelnen
            Orten oder Uhrzeiten bitte lokale Apps nutzen.
          </p>
        </div>

        <p className="mt-3 text-[10px] text-muted-foreground leading-snug">
          Quelle:{" "}
          <a
            href="https://open-meteo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Open‑Meteo
          </a>
        </p>
      </div>
    </details>
  );
}
