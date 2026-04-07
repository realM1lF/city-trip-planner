"use client";

import {
  InfoWindow,
  Map,
  Marker,
  useApiIsLoaded,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LocateFixedIcon } from "lucide-react";
import { toast } from "sonner";
import { MultiModeLegsLayer } from "@/components/planner/MultiModeLegsLayer";
import { RouteLayer } from "@/components/planner/RouteLayer";
import {
  StopMapLabels,
  type StopLabelPayload,
} from "@/components/planner/StopMapLabels";
import { stopGoogleMapsHref } from "@/lib/google-maps-place-url";
import { notifyMapBackgroundClick } from "@/lib/route-map-ui-bridge";
import { loadPlaceDetailsForMap } from "@/lib/place-details-for-map";
import {
  computeDayItinerary,
  formatScheduleMinutes,
  formatTimeWindow,
  implicitReturnArrivalTotalMin,
} from "@/lib/itinerary-time";
import { cn } from "@/lib/utils";
import type { PersistedPlannerStateV2 } from "@/types/trip";
import type { TripStop } from "@/types/trip";
import { Button } from "@/components/ui/button";

const BERLIN: google.maps.LatLngLiteral = { lat: 52.52, lng: 13.405 };

const INFO_WINDOW_PIXEL_OFFSET: [number, number] = [0, 8];

function FitTripBounds({ sorted }: { sorted: TripStop[] }) {
  const map = useMap();
  const boundsKey = useMemo(
    () =>
      sorted
        .map((s) => `${s.id}:${s.lat.toFixed(5)}:${s.lng.toFixed(5)}`)
        .join("|"),
    [sorted]
  );

  useEffect(() => {
    if (!map || sorted.length === 0) return;

    if (sorted.length === 1) {
      const p = sorted[0]!;
      map.panTo({ lat: p.lat, lng: p.lng });
      const z = map.getZoom();
      if (z !== undefined && z < 13) map.setZoom(14);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    for (const s of sorted) {
      bounds.extend({ lat: s.lat, lng: s.lng });
    }
    map.fitBounds(bounds, { top: 56, right: 56, bottom: 56, left: 56 });
  }, [map, boundsKey]);

  return null;
}

function UserLocationMarker({
  position,
}: {
  position: google.maps.LatLngLiteral;
}) {
  return (
    <Marker
      position={position}
      title="Dein Standort (Browser)"
      zIndex={9999}
      clickable={false}
      icon={{
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#1a73e8",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      }}
    />
  );
}

function PanMapTo({
  lat,
  lng,
  nonce,
}: {
  lat: number;
  lng: number;
  nonce: number;
}) {
  const map = useMap();
  const posRef = useRef({ lat, lng });
  posRef.current = { lat, lng };
  useEffect(() => {
    if (!map) return;
    const { lat: la, lng: ln } = posRef.current;
    map.panTo({ lat: la, lng: ln });
    const z = map.getZoom();
    if (z !== undefined && z < 14) {
      map.setZoom(14);
    }
  }, [map, nonce]);
  return null;
}

function StopInfoWindow({
  infoStop,
  infoWindowText,
  homeReturnArrivalLabel,
  stopIndex,
  onClose,
}: {
  infoStop: TripStop;
  infoWindowText: string | null;
  homeReturnArrivalLabel?: string | null;
  stopIndex: number;
  onClose: () => void;
}) {
  const map = useMap();
  const placesLib = useMapsLibrary("places");
  const [detailPhotoUrl, setDetailPhotoUrl] = useState<string | null>(null);
  const [detailMapsUri, setDetailMapsUri] = useState<string | null>(null);

  const storedThumb =
    infoStop.thumbnailUrl?.trim().length ? infoStop.thumbnailUrl.trim() : null;

  useEffect(() => {
    setDetailPhotoUrl(null);
    setDetailMapsUri(null);
    if (!infoStop.placeId?.trim() || !map || !placesLib) return;

    let cancelled = false;
    void loadPlaceDetailsForMap(map, infoStop.placeId).then((d) => {
      if (cancelled) return;
      setDetailPhotoUrl(d.photoUrl);
      setDetailMapsUri(d.googleMapsUri);
    });

    return () => {
      cancelled = true;
    };
  }, [map, placesLib, infoStop.id, infoStop.placeId]);

  const photoSrc = detailPhotoUrl ?? storedThumb;

  const mapsHref = useMemo(
    () => stopGoogleMapsHref(infoStop),
    [
      infoStop.formattedAddress,
      infoStop.id,
      infoStop.label,
      infoStop.lat,
      infoStop.lng,
      infoStop.placeId,
    ]
  );
  const openMapsHref = detailMapsUri ?? mapsHref;

  return (
    <InfoWindow
      key={`${infoStop.id}|${infoStop.arrivalTime ?? ""}|${infoStop.departureTime ?? ""}|${infoStop.notes ?? ""}|${infoWindowText ?? ""}|${infoStop.isAccommodation ? "1" : "0"}|${homeReturnArrivalLabel ?? ""}|${infoStop.dwellMinutes}|${stopIndex}`}
      position={{ lat: infoStop.lat, lng: infoStop.lng }}
      headerContent={
        <h3 className="map-infowindow-header">{infoStop.label}</h3>
      }
      onCloseClick={onClose}
      onClose={onClose}
      shouldFocus={false}
      className="map-infowindow-root"
      pixelOffset={INFO_WINDOW_PIXEL_OFFSET}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {photoSrc ? (
          <img
            src={photoSrc}
            alt=""
            className="map-iw-photo"
          />
        ) : null}
        {infoWindowText ? (
          <div className="mb-1">
            <p className="map-iw-schedule-label">Zeitfenster</p>
            <p className="map-iw-schedule-time tabular-nums">{infoWindowText}</p>
          </div>
        ) : (
          <div className="map-iw-muted">
            Kein berechnetes Zeitfenster (Kalendertag oder Route fehlt in der
            Ansicht).
          </div>
        )}
        {stopIndex > 0 && infoStop.arrivalTime?.trim() ? (
          <p className="map-iw-muted">
            Bin da (manuell):{" "}
            <span className="tabular-nums text-[#0a0a0a]">
              {infoStop.arrivalTime}
            </span>
          </p>
        ) : null}
        {infoStop.departureTime?.trim() ? (
          <p className="map-iw-muted">
            Bin gegangen (manuell):{" "}
            <span className="tabular-nums text-[#0a0a0a]">
              {infoStop.departureTime}
            </span>
          </p>
        ) : null}
        <p className="map-iw-dwell-label mb-1 font-normal">
          Verweildauer:{" "}
          <span className="font-semibold text-[#0a0a0a]">
            {infoStop.dwellMinutes} Min.
          </span>
        </p>
        {infoStop.notes ? (
          <div className="map-iw-muted">Notiz: {infoStop.notes}</div>
        ) : null}
        {infoStop.isAccommodation ? (
          <div className="map-iw-muted">Als Unterkunft markiert.</div>
        ) : null}
        {infoStop.isAccommodation && homeReturnArrivalLabel ? (
          <div className="map-iw-muted">
            Heimkehr (nach letztem Listen‑Stopp) ca. {homeReturnArrivalLabel}
          </div>
        ) : null}
        <div className="map-iw-muted">{infoStop.formattedAddress}</div>
        <a
          href={openMapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="map-iw-place-link"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          In Google Maps öffnen
        </a>
      </div>
    </InfoWindow>
  );
}

function ShareDayTabs({
  days,
  activeDayId,
  onSelect,
}: {
  days: { id: string; label: string }[];
  activeDayId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-1 border-b border-border/60 bg-background/95 px-2 py-2 backdrop-blur-sm"
      role="tablist"
      aria-label="Tage"
    >
      {days.map((d) => (
        <button
          key={d.id}
          type="button"
          role="tab"
          aria-selected={activeDayId === d.id}
          className={cn(
            "rounded-md px-2.5 py-1 text-sm transition-colors",
            activeDayId === d.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          )}
          onClick={() => onSelect(d.id)}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

type Props = { persisted: PersistedPlannerStateV2 };

export function ShareMapView({ persisted }: Props) {
  const trip = persisted.trip;
  const travelMode = persisted.travelMode;
  const routeLegByDay = persisted.routeLegDurationsByDayId ?? {};

  const [activeDayId, setActiveDayId] = useState(persisted.activeDayId);

  useEffect(() => {
    setActiveDayId(persisted.activeDayId);
  }, [persisted.activeDayId]);

  const legSeconds = routeLegByDay[activeDayId];

  const activeDay = trip.days.find((d) => d.id === activeDayId);
  const activeDayStops = activeDay?.stops;
  const sorted = useMemo(() => {
    if (!activeDayStops) return [];
    return [...activeDayStops].sort((a, b) => a.order - b.order);
  }, [activeDayStops, activeDayId]);

  const [infoStopId, setInfoStopId] = useState<string | null>(null);
  const [labelFocusStopId, setLabelFocusStopId] = useState<string | null>(
    null
  );
  const ignoreMapCloseUntilRef = useRef(0);

  const closeInfo = useCallback(() => setInfoStopId(null), []);

  useEffect(() => {
    if (infoStopId && !sorted.some((x) => x.id === infoStopId)) {
      setInfoStopId(null);
    }
  }, [sorted, infoStopId]);

  useEffect(() => {
    if (
      labelFocusStopId &&
      !sorted.some((x) => x.id === labelFocusStopId)
    ) {
      setLabelFocusStopId(null);
    }
  }, [sorted, labelFocusStopId]);

  const activateStopLabelCard = useCallback((id: string) => {
    ignoreMapCloseUntilRef.current = performance.now() + 400;
    setLabelFocusStopId(id);
  }, []);

  const itinerary = useMemo(
    () => computeDayItinerary(sorted, legSeconds ?? undefined, activeDay),
    [sorted, legSeconds, activeDay]
  );

  const timeByStopId = useMemo(() => {
    if (!itinerary.ok) return null;
    const m: Record<string, string> = {};
    for (const row of itinerary.itinerary.stops) {
      m[row.stopId] = formatTimeWindow(
        row.arrivalTotalMin,
        row.departureTotalMin
      );
    }
    return m;
  }, [itinerary]);

  const implicitTargetId = activeDay?.implicitReturnToStopId?.trim() ?? null;
  const implicitHomeArrivalLabel = useMemo(() => {
    if (!itinerary.ok || !activeDay) return null;
    const min = implicitReturnArrivalTotalMin(
      itinerary.itinerary,
      sorted,
      activeDay
    );
    if (min == null) return null;
    return formatScheduleMinutes(min);
  }, [itinerary, sorted, activeDay]);

  const labelPayloads = useMemo<StopLabelPayload[]>(
    () =>
      sorted.map((s, i) => ({
        id: s.id,
        position: { lat: s.lat, lng: s.lng },
        index: i + 1,
        title: s.label,
        timeWindowLabel: timeByStopId?.[s.id] ?? null,
        homeReturnArrivalLabel:
          s.isAccommodation &&
          implicitTargetId !== null &&
          s.id === implicitTargetId
            ? implicitHomeArrivalLabel
            : null,
        thumbnailUrl: s.thumbnailUrl ?? null,
        isAccommodation: s.isAccommodation,
      })),
    [sorted, timeByStopId, implicitHomeArrivalLabel, implicitTargetId]
  );

  const infoStop = infoStopId
    ? sorted.find((x) => x.id === infoStopId)
    : null;
  const infoStopIndex = infoStop
    ? sorted.findIndex((x) => x.id === infoStop.id)
    : -1;
  const infoWindowText = infoStop
    ? (timeByStopId?.[infoStop.id] ?? null)
    : null;

  const mapDefaultCenter = useMemo<google.maps.LatLngLiteral>(() => {
    if (sorted.length === 0) return BERLIN;
    const lat = sorted.reduce((a, s) => a + s.lat, 0) / sorted.length;
    const lng = sorted.reduce((a, s) => a + s.lng, 0) / sorted.length;
    return { lat, lng };
  }, [sorted]);

  const [userLocation, setUserLocation] =
    useState<google.maps.LatLngLiteral | null>(null);
  const [trackUserLocation, setTrackUserLocation] = useState(false);
  const [panToUserNonce, setPanToUserNonce] = useState(0);
  const locationHelpToastShown = useRef(false);

  useEffect(() => {
    if (!trackUserLocation) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      undefined,
      {
        enableHighAccuracy: false,
        maximumAge: 20_000,
        timeout: 25_000,
      }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [trackUserLocation]);

  const requestMyLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Dein Browser unterstützt keine Standortabfrage.");
      return;
    }

    const onOk = (pos: GeolocationPosition) => {
      const loc = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      setUserLocation(loc);
      setTrackUserLocation(true);
      setPanToUserNonce((n) => n + 1);
      if (!locationHelpToastShown.current) {
        locationHelpToastShown.current = true;
        toast.success(
          "Standort aktiv. Der blaue Punkt folgt dir, solange die Seite offen ist."
        );
      } else {
        toast.message("Karte auf dich zentriert.", { duration: 2000 });
      }
    };

    const onFinalError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        toast.error(
          "Standort blockiert. In der Adressleiste auf Schloss bzw. ⓘ tippen und für diese Seite „Standort: Erlauben“ wählen, dann erneut auf das Fadenkreuz."
        );
        return;
      }
      if (err.code === err.POSITION_UNAVAILABLE) {
        toast.error(
          "Ort unbekannt (auch nach grober Netzwerk-Ortung). Am PC oft ohne GPS: Betriebssystem-Ortung aktivieren, WLAN nutzen, VPN testweise aus; unter Linux z. B. Geoclue. Dann Fadenkreuz nochmal."
        );
        return;
      }
      if (err.code === err.TIMEOUT) {
        toast.error(
          "Zeitüberschreitung. Bitte erneut auf Mein Standort tippen — wir versuchen es dann mit längerer Wartezeit und ohne „hohe Genauigkeit“."
        );
        return;
      }
      toast.error("Standort nicht verfügbar.");
    };

    navigator.geolocation.getCurrentPosition(
      onOk,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          onFinalError(err);
          return;
        }
        navigator.geolocation.getCurrentPosition(onOk, onFinalError, {
          enableHighAccuracy: false,
          maximumAge: 300_000,
          timeout: 35_000,
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 12_000,
      }
    );
  }, []);

  const apiLoaded = useApiIsLoaded();

  const handleMapClick = useCallback(() => {
    if (performance.now() < ignoreMapCloseUntilRef.current) return;
    notifyMapBackgroundClick();
    setLabelFocusStopId(null);
    if (infoStopId !== null) closeInfo();
  }, [infoStopId, closeInfo]);

  const routeSnapshot = useMemo(
    () => ({ activeDayId, trip, travelMode }),
    [activeDayId, trip, travelMode]
  );

  if (!apiLoaded) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground text-sm">
        Karte wird geladen …
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ShareDayTabs
        days={trip.days.map((d) => ({ id: d.id, label: d.label }))}
        activeDayId={activeDayId}
        onSelect={setActiveDayId}
      />
      <div className="relative min-h-0 flex-1">
        <Map
          className="h-full w-full"
          defaultCenter={mapDefaultCenter}
          defaultZoom={sorted.length >= 2 ? 12 : 13}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeControl={false}
          onClick={handleMapClick}
        >
          {sorted.length > 0 ? (
            <StopMapLabels
              stops={labelPayloads}
              focusStopId={labelFocusStopId}
              onActivateStopCard={activateStopLabelCard}
            />
          ) : null}

          {sorted.map((s, i) => {
            const tw = timeByStopId?.[s.id];
            let title = tw
              ? `${i + 1}. ${s.label} · ${tw}`
              : `${i + 1}. ${s.label}`;
            if (s.isAccommodation) title += " · Unterkunft";
            if (
              s.isAccommodation &&
              implicitTargetId === s.id &&
              implicitHomeArrivalLabel
            ) {
              title += ` · Heimkehr ca. ${implicitHomeArrivalLabel}`;
            }
            return (
              <Marker
                key={s.id}
                position={{ lat: s.lat, lng: s.lng }}
                title={title}
                label={{
                  text: String(i + 1),
                  color: "white",
                  fontSize: "11px",
                  fontWeight: "600",
                }}
                onClick={(e) => {
                  e.stop();
                  ignoreMapCloseUntilRef.current = performance.now() + 400;
                  setInfoStopId(s.id);
                }}
              />
            );
          })}

          {userLocation ? <UserLocationMarker position={userLocation} /> : null}
          {userLocation && panToUserNonce > 0 ? (
            <PanMapTo
              lat={userLocation.lat}
              lng={userLocation.lng}
              nonce={panToUserNonce}
            />
          ) : null}

          {sorted.length > 0 ? <FitTripBounds sorted={sorted} /> : null}

          <RouteLayer readOnly snapshot={routeSnapshot} />
          <MultiModeLegsLayer readOnly />

          {infoStop && infoStopIndex >= 0 ? (
            <StopInfoWindow
              infoStop={infoStop}
              infoWindowText={infoWindowText}
              homeReturnArrivalLabel={
                infoStop.isAccommodation &&
                implicitTargetId === infoStop.id
                  ? implicitHomeArrivalLabel
                  : null
              }
              stopIndex={infoStopIndex}
              onClose={closeInfo}
            />
          ) : null}
        </Map>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="pointer-events-auto absolute right-4 bottom-20 z-20 h-10 gap-1.5 rounded-full px-3 shadow-md md:bottom-4 [&_svg]:size-5"
          title="Erst tippen — dann fragt der Browser nach Standort. Ohne Klick: kein GPS."
          aria-label="Mein Standort anzeigen (Browser fragt nach Erlaubnis)"
          onClick={(e) => {
            e.stopPropagation();
            requestMyLocation();
          }}
        >
          <LocateFixedIcon className="shrink-0" aria-hidden />
          <span className="hidden max-w-[5.5rem] truncate sm:inline text-xs font-medium leading-none">
            Standort
          </span>
        </Button>
      </div>
    </div>
  );
}
