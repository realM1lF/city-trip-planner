import type { Trip, TripDay, TripStop } from "@/types/trip";

/** Explizit kopieren, damit localStorage/JSON alle Felder zuverlässig enthält (z. B. Abreise, Leg-Modi). */
function cloneStop(s: TripStop): TripStop {
  const out: TripStop = {
    id: s.id,
    order: s.order,
    label: s.label,
    lat: s.lat,
    lng: s.lng,
    formattedAddress: s.formattedAddress,
    dwellMinutes: s.dwellMinutes,
  };
  if (s.placeId !== undefined) out.placeId = s.placeId;
  if (s.thumbnailUrl !== undefined) out.thumbnailUrl = s.thumbnailUrl;
  if (s.arrivalTime !== undefined) out.arrivalTime = s.arrivalTime;
  if (s.departureTime !== undefined) out.departureTime = s.departureTime;
  if (s.notes !== undefined) out.notes = s.notes;
  if (s.isAccommodation) out.isAccommodation = true;
  return out;
}

function cloneDay(d: TripDay): TripDay {
  const out: TripDay = {
    id: d.id,
    label: d.label,
    date: d.date,
    stops: d.stops.map(cloneStop),
  };
  if (d.legTravelModes !== undefined) {
    out.legTravelModes = [...d.legTravelModes];
  }
  if (d.implicitReturnToStopId != null && d.implicitReturnToStopId !== "") {
    out.implicitReturnToStopId = d.implicitReturnToStopId;
  }
  return out;
}

export function cloneTripForPersistence(trip: Trip): Trip {
  return {
    id: trip.id,
    name: trip.name,
    days: trip.days.map(cloneDay),
  };
}
