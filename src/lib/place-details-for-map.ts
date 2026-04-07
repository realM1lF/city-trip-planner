/** Details für Karten-Infofenster: neue Place-Klasse zuerst, sonst Legacy PlacesService. */

export type PlaceDetailsForMap = {
  photoUrl: string | null;
  /** Offizielle Google-Maps-Seite zum Ort (Maps-/Business-Ansicht). */
  googleMapsUri: string | null;
};

function firstPhotoUrl(
  photo:
    | {
        getURI?: (o: { maxHeight?: number; maxWidth?: number }) => string;
        getUrl?: (o: { maxWidth?: number }) => string;
      }
    | undefined
): string | null {
  if (!photo) return null;
  const u =
    photo.getURI?.({ maxHeight: 480 }) ??
    photo.getURI?.({ maxWidth: 480 }) ??
    photo.getUrl?.({ maxWidth: 480 });
  return u && u.length > 0 ? u : null;
}

/**
 * Lädt Foto-URL und offizielle Maps-URL für einen Stopp.
 * `placeId` kann `ChIJ…` oder `places/ChIJ…` sein.
 */
export function loadPlaceDetailsForMap(
  map: google.maps.Map,
  placeId: string
): Promise<PlaceDetailsForMap> {
  const trimmed = placeId.trim();
  if (!trimmed) return Promise.resolve({ photoUrl: null, googleMapsUri: null });

  const legacy = trimmed.startsWith("places/")
    ? trimmed.slice("places/".length)
    : trimmed;
  const resourceName = trimmed.startsWith("places/")
    ? trimmed
    : `places/${legacy}`;

  const PlaceCtor = google.maps.places.Place;
  if (typeof PlaceCtor === "function") {
    const tryPlace = async (options: google.maps.places.PlaceOptions) => {
      const place = new PlaceCtor(options);
      await place.fetchFields({
        fields: ["photos", "googleMapsUri"],
      });
      const uri =
        place.googleMapsURI != null && String(place.googleMapsURI).length > 0
          ? String(place.googleMapsURI)
          : null;
      return {
        photoUrl: firstPhotoUrl(place.photos?.[0]),
        googleMapsUri: uri,
      } satisfies PlaceDetailsForMap;
    };

    return tryPlace({ id: legacy })
      .then(async (first) => {
        if (first.photoUrl || first.googleMapsUri) return first;
        return tryPlace({ id: resourceName });
      })
      .then(async (second) => {
        if (second.photoUrl || second.googleMapsUri) return second;
        return legacyPlacesServiceFallback(map, legacy);
      })
      .catch(() => legacyPlacesServiceFallback(map, legacy));
  }

  return legacyPlacesServiceFallback(map, legacy);
}

function legacyPlacesServiceFallback(
  map: google.maps.Map,
  legacyPlaceId: string
): Promise<PlaceDetailsForMap> {
  return new Promise((resolve) => {
    const svc = new google.maps.places.PlacesService(map);
    svc.getDetails(
      {
        placeId: legacyPlaceId,
        fields: ["photos", "url"],
      },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          resolve({ photoUrl: null, googleMapsUri: null });
          return;
        }
        const p = place.photos?.[0];
        const photoUrl = p?.getUrl?.({ maxWidth: 480 }) ?? null;
        const googleMapsUri =
          place.url != null && place.url.length > 0 ? place.url : null;
        resolve({
          photoUrl: photoUrl && photoUrl.length > 0 ? photoUrl : null,
          googleMapsUri,
        });
      }
    );
  });
}
