/**
 * Parallelversatz einer Polylinie in Metern (Google Maps Spherical).
 * Positives offset = „rechts“ relativ zur Laufrichtung (computeHeading + 90°).
 */

type SphericalLike = {
  computeHeading(from: google.maps.LatLng, to: google.maps.LatLng): number;
  computeOffset(
    from: google.maps.LatLng,
    distance: number,
    heading: number
  ): google.maps.LatLng;
  computeDistanceBetween(a: google.maps.LatLng, b: google.maps.LatLng): number;
};

const MIN_SEG_M = 0.05;

function headingAtVertex(
  path: google.maps.LatLng[],
  i: number,
  spherical: SphericalLike
): number {
  const n = path.length;
  if (n < 2) return 0;
  if (i === 0) {
    return spherical.computeHeading(path[0]!, path[1]!);
  }
  if (i === n - 1) {
    return spherical.computeHeading(path[n - 2]!, path[n - 1]!);
  }
  const a = path[i - 1]!;
  const b = path[i + 1]!;
  if (spherical.computeDistanceBetween(a, b) < MIN_SEG_M) {
    return spherical.computeHeading(path[i - 1]!, path[i]!);
  }
  return spherical.computeHeading(a, b);
}

export function polylineLateralOffsetMeters(
  path: google.maps.LatLng[],
  offsetMeters: number,
  spherical: SphericalLike
): google.maps.LatLng[] {
  if (path.length === 0) return [];
  if (Math.abs(offsetMeters) < 1e-6 || path.length === 1) {
    return path.slice();
  }

  const out: google.maps.LatLng[] = [];
  for (let i = 0; i < path.length; i++) {
    const h = headingAtVertex(path, i, spherical);
    out.push(spherical.computeOffset(path[i]!, offsetMeters, h + 90));
  }
  return out;
}
