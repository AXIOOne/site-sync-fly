export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_R = 6371000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pathLengthMeters(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineMeters(points[i - 1]!, points[i]!);
  }
  return total;
}

/** Bearing in degrees (0-360) from a to b. */
export function bearing(a: LatLng, b: LatLng): number {
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/** Shoelace area (m²) for a ring of [lng, lat] pairs. */
export function ringAreaSqMeters(ring: [number, number][]): number {
  if (ring.length < 3) return 0;
  const latRef = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * (Math.PI / 180);
  const mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * latRef) + 1.175 * Math.cos(4 * latRef);
  const mPerDegLng = 111412.84 * Math.cos(latRef) - 93.5 * Math.cos(3 * latRef);
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    sum += x1 * mPerDegLng * (y2 * mPerDegLat) - x2 * mPerDegLng * (y1 * mPerDegLat);
  }
  return Math.abs(sum / 2);
}

export function centroid(ring: [number, number][]): LatLng {
  const lng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return { latitude: lat, longitude: lng };
}

export function bounds(ring: [number, number][]) {
  const lngs = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return {
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}

export function pointInRing(point: LatLng, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const intersect =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function metersToDegLat(m: number): number {
  return m / 110574;
}

export function metersToDegLng(m: number, atLat: number): number {
  return m / (111320 * Math.cos((atLat * Math.PI) / 180));
}

export function ringFromGeoJson(geojson: unknown): [number, number][] | null {
  const feature = geojson as {
    geometry?: { type?: string; coordinates?: unknown };
    type?: string;
    coordinates?: unknown;
  } | null;
  if (!feature) return null;
  const geometry = feature.geometry ?? (feature as { type?: string; coordinates?: unknown });
  if (geometry?.type !== "Polygon" || !Array.isArray(geometry.coordinates)) return null;
  const ring = (geometry.coordinates as [number, number][][])[0];
  return Array.isArray(ring) ? ring : null;
}

export function polygonFeature(ring: [number, number][], props: Record<string, unknown> = {}) {
  const closed =
    ring.length > 2 && (ring[0]![0] !== ring[ring.length - 1]![0] || ring[0]![1] !== ring[ring.length - 1]![1])
      ? [...ring, ring[0]!]
      : ring;
  return {
    type: "Feature" as const,
    properties: props,
    geometry: { type: "Polygon" as const, coordinates: [closed] },
  };
}

export const MPH_TO_MS = 0.44704;
export const FT_TO_M = 0.3048;
export const SQM_TO_ACRES = 0.000247105;
