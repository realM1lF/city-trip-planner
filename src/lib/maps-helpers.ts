import type { TravelModeOption } from "@/types/trip";

export function toGoogleTravelMode(
  mode: TravelModeOption
): google.maps.TravelMode {
  switch (mode) {
    case "DRIVING":
      return google.maps.TravelMode.DRIVING;
    case "BICYCLING":
      return google.maps.TravelMode.BICYCLING;
    case "TRANSIT":
      return google.maps.TravelMode.TRANSIT;
    case "WALKING":
    default:
      return google.maps.TravelMode.WALKING;
  }
}

/** `travelmode`-Parameter für Google Maps dir-Links (Web). */
export type GoogleMapsDirTravelMode =
  | "walking"
  | "driving"
  | "transit"
  | "bicycling";

/**
 * Öffnet Google Maps Wegbeschreibung ( externes Tab/Web ).
 * @see https://developers.google.com/maps/documentation/urls/get-started#directions-action
 */
export function buildGoogleMapsDirectionsUrl(params: {
  origin: google.maps.LatLngLiteral;
  destination: google.maps.LatLngLiteral;
  travelmode?: GoogleMapsDirTravelMode;
}): string {
  const origin = `${params.origin.lat},${params.origin.lng}`;
  const destination = `${params.destination.lat},${params.destination.lng}`;
  const tm = params.travelmode
    ? `&travelmode=${encodeURIComponent(params.travelmode)}`
    : "";
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${tm}`;
}

export function travelModeOptionToDirParam(
  mode: TravelModeOption
): GoogleMapsDirTravelMode {
  switch (mode) {
    case "DRIVING":
      return "driving";
    case "BICYCLING":
      return "bicycling";
    case "TRANSIT":
      return "transit";
    case "WALKING":
    default:
      return "walking";
  }
}

/** Mehrere Stopps als eine durchgehende Wegbeschreibung in Google Maps (Web). */
export function buildGoogleMapsDirectionsUrlForStops(
  stops: google.maps.LatLngLiteral[],
  travelmode: GoogleMapsDirTravelMode
): string | null {
  if (stops.length < 2) return null;
  const a = stops[0]!;
  const b = stops[stops.length - 1]!;
  const origin = `${a.lat},${a.lng}`;
  const destination = `${b.lat},${b.lng}`;
  const middle = stops.slice(1, -1);
  const wp =
    middle.length > 0
      ? `&waypoints=${middle.map((p) => `${p.lat},${p.lng}`).join("|")}`
      : "";
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${wp}&travelmode=${encodeURIComponent(travelmode)}`;
}
