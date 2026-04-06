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

export function PlaceAutocomplete({
  disabled,
  placeholder = "Ort suchen …",
  onPlaceSelected,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onSelectRef = useRef(onPlaceSelected);
  onSelectRef.current = onPlaceSelected;
  const placesLib = useMapsLibrary("places");

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;

    const AutocompleteCtor = placesLib.Autocomplete;
    const ac = new AutocompleteCtor(inputRef.current, {
      fields: [
        "place_id",
        "geometry",
        "formatted_address",
        "name",
        "photos",
      ],
    });

    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const loc = place.geometry?.location;
      if (!loc) return;

      const firstPhoto = place.photos?.[0];
      const thumbnailUrl =
        firstPhoto?.getUrl?.({ maxWidth: 480 }) ?? undefined;

      onSelectRef.current({
        placeId: place.place_id,
        lat: loc.lat(),
        lng: loc.lng(),
        formattedAddress:
          place.formatted_address ?? place.name ?? "Unbekannter Ort",
        label: place.name ?? place.formatted_address ?? "Stopp",
        thumbnailUrl,
      });
      if (inputRef.current) inputRef.current.value = "";
    });

    return () => {
      listener.remove();
    };
  }, [placesLib]);

  return (
    <input
      ref={inputRef}
      type="search"
      disabled={disabled || !placesLib}
      placeholder={placesLib ? placeholder : "Karte lädt …"}
      autoComplete="off"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none md:text-sm",
        "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
      )}
    />
  );
}
