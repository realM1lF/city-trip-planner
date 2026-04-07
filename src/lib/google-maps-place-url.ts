import type { TripStop } from "@/types/trip";

/** Fallback-URL, wenn keine `googleMapsURI` von der Places API vorliegt. */
export function stopGoogleMapsHref(stop: TripStop): string {
  if (stop.placeId) {
    const legacy =
      stop.placeId.startsWith("places/")
        ? stop.placeId.slice("places/".length)
        : stop.placeId;
    const q = stop.label.trim() || stop.formattedAddress.trim() || legacy;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}&query_place_id=${encodeURIComponent(legacy)}`;
  }
  const q = stop.formattedAddress.trim();
  if (q.length > 0) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stop.lat},${stop.lng}`)}`;
}
