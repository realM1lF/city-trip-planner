/** Web-Mercator-Näherung: Meter pro Pixel am gegebenen Breitengrad und Zoom. */
const EQUATOR_METERS_PER_PIXEL_Z0 = 156543.03392;

export function metersPerPixelAt(lat: number, zoom: number): number {
  return (
    (EQUATOR_METERS_PER_PIXEL_Z0 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
  );
}

/** Ziel: Abstand zwischen benachbarten Teilstrecken in Pixeln (nur Darstellung). */
export const LEG_VISUAL_OFFSET_TARGET_PX = 4;

export const LEG_VISUAL_OFFSET_STEP_M_MIN = 1.5;
export const LEG_VISUAL_OFFSET_STEP_M_MAX = 45;

/** Fallback, wenn Karte/Center fehlt (vor dem ersten idle). */
export const LEG_VISUAL_OFFSET_FALLBACK_M = 2.5;

export function legVisualOffsetStepMetersForZoom(
  lat: number,
  zoom: number
): number {
  const raw = LEG_VISUAL_OFFSET_TARGET_PX * metersPerPixelAt(lat, zoom);
  return Math.min(
    LEG_VISUAL_OFFSET_STEP_M_MAX,
    Math.max(LEG_VISUAL_OFFSET_STEP_M_MIN, raw)
  );
}
