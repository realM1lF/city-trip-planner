import type { TripStop } from "@/types/trip";

/** Öffnet den Ort in Google Maps (Place-ID bevorzugt, sonst Adresse oder Koordinaten). */
export function stopGoogleMapsHref(stop: TripStop): string {
  if (stop.placeId) {
    const legacy =
      stop.placeId.startsWith("places/")
        ? stop.placeId.slice("places/".length)
        : stop.placeId;
    return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(legacy)}`;
  }
  const q = stop.formattedAddress.trim();
  if (q.length > 0) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stop.lat},${stop.lng}`)}`;
}
