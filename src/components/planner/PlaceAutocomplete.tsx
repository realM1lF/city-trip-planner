"use client";

import { useEffect, useRef } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { cn } from "@/lib/utils";

type Props = {
  disabled?: boolean;
  placeholder?: string;
  onPlaceSelected: (place: {
    placeId?: string;
    lat: number;
    lng: number;
    formattedAddress: string;
    label: string;
    thumbnailUrl?: string;
  }) => void;
};

/** Places API (New) liefert `places/ChIJ…`; Legacy PlacesService erwartet `ChIJ…`. */
function legacyPlaceId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return id.startsWith("places/") ? id.slice("places/".length) : id;
}

function coordsFromLocation(
  loc: google.maps.LatLng | google.maps.LatLngLiteral | undefined | null
): { lat: number; lng: number } | null {
  if (loc == null) return null;
  if (typeof (loc as google.maps.LatLng).lat === "function") {
    const ll = loc as google.maps.LatLng;
    return { lat: ll.lat(), lng: ll.lng() };
  }
  const lit = loc as google.maps.LatLngLiteral;
  if (typeof lit.lat !== "number" || typeof lit.lng !== "number") return null;
  return { lat: lit.lat, lng: lit.lng };
}

type PlacePredictionLike = {
  toPlace: () => {
    fetchFields: (opts: { fields: string[] }) => Promise<void>;
    location?: google.maps.LatLng | google.maps.LatLngLiteral;
    id?: string;
    displayName?: string;
    formattedAddress?: string;
    photos?: Array<{
      getURI?: (o: { maxWidth: number }) => string;
      getUrl?: (o: { maxWidth: number }) => string;
    }>;
  };
};

function predictionFromGmpSelectEvent(ev: Event): PlacePredictionLike | undefined {
  const top = ev as Event & { placePrediction?: PlacePredictionLike };
  if (top.placePrediction) return top.placePrediction;
  const d = (ev as CustomEvent<{ placePrediction?: PlacePredictionLike }>).detail;
  return d?.placePrediction;
}

function thumbFromPhoto(firstPhoto: {
  getURI?: (o: { maxWidth: number }) => string;
  getUrl?: (o: { maxWidth: number }) => string;
}): string | undefined {
  const u = firstPhoto.getURI?.({ maxWidth: 480 }) ?? firstPhoto.getUrl?.({ maxWidth: 480 });
  return u;
}

export function PlaceAutocomplete({
  disabled,
  placeholder = "Ort suchen …",
  onPlaceSelected,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onPlaceSelected);
  onSelectRef.current = onPlaceSelected;
  const placesLib = useMapsLibrary("places");

  useEffect(() => {
    if (!placesLib || !containerRef.current) return;

    const AutocompleteEl = google.maps.places.PlaceAutocompleteElement;
    if (!AutocompleteEl) return;

    const el = new AutocompleteEl({});
    el.setAttribute("placeholder", placeholder);
    if (disabled) el.setAttribute("disabled", "");
    else el.removeAttribute("disabled");

    el.className = cn(
      "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none md:text-sm",
      "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
      "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
    );

    const onSelect = async (ev: Event) => {
      const placePrediction = predictionFromGmpSelectEvent(ev);
      if (!placePrediction) return;
      const place = placePrediction.toPlace();
      try {
        await place.fetchFields({
          fields: ["displayName", "formattedAddress", "location", "id", "photos"],
        });
      } catch {
        return;
      }
      const coords = coordsFromLocation(place.location);
      if (!coords) return;

      const firstPhoto = place.photos?.[0];
      const thumbnailUrl = firstPhoto ? thumbFromPhoto(firstPhoto) : undefined;

      onSelectRef.current({
        placeId: legacyPlaceId(place.id),
        lat: coords.lat,
        lng: coords.lng,
        formattedAddress:
          place.formattedAddress ?? place.displayName ?? "Unbekannter Ort",
        label: place.displayName ?? place.formattedAddress ?? "Stopp",
        thumbnailUrl,
      });

      type WithValue = { value?: string };
      const w = el as WithValue;
      if (typeof w.value === "string") w.value = "";
    };

    el.addEventListener("gmp-select", onSelect as EventListener);
    containerRef.current.appendChild(el);

    return () => {
      el.removeEventListener("gmp-select", onSelect as EventListener);
      el.remove();
    };
  }, [placesLib, placeholder, disabled]);

  if (!placesLib) {
    return (
      <input
        type="search"
        disabled
        placeholder="Karte lädt …"
        autoComplete="off"
        readOnly
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none md:text-sm",
          "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
        )}
      />
    );
  }

  return <div ref={containerRef} className="planner-place-autocomplete-host w-full min-w-0" />;
}
