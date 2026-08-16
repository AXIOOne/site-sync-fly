import {
  FT_TO_M,
  MPH_TO_MS,
  bearing,
  bounds,
  centroid,
  metersToDegLat,
  metersToDegLng,
  pathLengthMeters,
  pointInRing,
  ringAreaSqMeters,
  type LatLng,
} from "./geo";
import type { MissionType, WaypointActionType } from "./domain";

export interface DraftAction {
  action_type: WaypointActionType;
  param_numeric?: number | null;
}

/**
 * How the aircraft heading at a waypoint was decided.
 * - fixed: an explicit bearing the planner set; never recomputed silently
 * - aim:   computed from the waypoint to a picked target on the map
 * - center: always faces the site centroid
 * - path:  follows the route (faces the next waypoint)
 */
export type HeadingMode = "fixed" | "aim" | "center" | "path";

export const HEADING_MODE_LABELS: Record<HeadingMode, string> = {
  fixed: "Fixed bearing",
  aim: "Aim at target",
  center: "Face center",
  path: "Follow path",
};

export interface DraftWaypoint {
  key: string;
  sequence: number;
  latitude: number;
  longitude: number;
  altitude_ft: number;
  heading: number | null;
  heading_mode: HeadingMode;
  aim_lat?: number | null;
  aim_lng?: number | null;
  gimbal_pitch: number;
  speed_mph: number | null;
  label: string | null;
  actions: DraftAction[];
}

const COMPASS_POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

export function normalizeHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function compassPoint(deg: number): string {
  const idx = Math.round(normalizeHeading(deg) / 22.5) % 16;
  return COMPASS_POINTS[idx]!;
}

export function formatHeading(heading: number | null): string {
  if (heading == null) return "no heading";
  const h = Math.round(normalizeHeading(heading));
  return `${String(h).padStart(3, "0")}° ${compassPoint(h)}`;
}

export const CAPTURE_ACTIONS: WaypointActionType[] = ["take_photo", "start_video"];

export function capturesMedia(waypoint: DraftWaypoint): boolean {
  return waypoint.actions.some((a) => CAPTURE_ACTIONS.includes(a.action_type));
}

/**
 * Recompute headings for every waypoint whose mode is derived (aim / center / path).
 * "fixed" headings are preserved exactly as the planner set them.
 */
export function resolveWaypointHeadings(list: DraftWaypoint[], center: LatLng | null): DraftWaypoint[] {
  const sorted = [...list].sort((a, b) => a.sequence - b.sequence);
  return sorted.map((w, i) => {
    const self = { latitude: w.latitude, longitude: w.longitude };
    if (w.heading_mode === "aim") {
      if (w.aim_lat == null || w.aim_lng == null) return w;
      return { ...w, heading: Math.round(bearing(self, { latitude: w.aim_lat, longitude: w.aim_lng })) };
    }
    if (w.heading_mode === "center") {
      if (!center) return w;
      return { ...w, heading: Math.round(bearing(self, center)) };
    }
    if (w.heading_mode === "path") {
      const neighbour = sorted[i + 1] ?? sorted[i - 1] ?? null;
      if (!neighbour) return w;
      const target = { latitude: neighbour.latitude, longitude: neighbour.longitude };
      const bear = bearing(self, target);
      return { ...w, heading: Math.round(sorted[i + 1] ? bear : normalizeHeading(bear + 180)) };
    }
    return w;
  });
}

/**
 * Ensure a waypoint that captures media rotates the aircraft to the planned
 * heading before the shutter fires. Returns actions in execution order.
 */
export function withRotateBeforeCapture(waypoint: DraftWaypoint): DraftAction[] {
  const actions = waypoint.actions;
  if (waypoint.heading == null || !capturesMedia(waypoint)) return actions;
  if (actions.some((a) => a.action_type === "rotate_aircraft")) {
    return actions.map((a) =>
      a.action_type === "rotate_aircraft"
        ? { ...a, param_numeric: Math.round(normalizeHeading(waypoint.heading!)) }
        : a,
    );
  }
  const firstCapture = actions.findIndex((a) => CAPTURE_ACTIONS.includes(a.action_type));
  const rotate: DraftAction = {
    action_type: "rotate_aircraft",
    param_numeric: Math.round(normalizeHeading(waypoint.heading)),
  };
  return [...actions.slice(0, firstCapture), rotate, ...actions.slice(firstCapture)];
}


let keyCounter = 0;
export function newWaypointKey(): string {
  keyCounter += 1;
  return `wp-${Date.now().toString(36)}-${keyCounter}`;
}

export interface GenerationSettings {
  altitude_ft: number;
  speed_mph: number;
  gimbal_pitch: number;
  front_overlap: number;
  side_overlap: number;
  flight_direction: number;
  pointToCenter: boolean;
}

export const DEFAULT_GENERATION: GenerationSettings = {
  altitude_ft: 150,
  speed_mph: 12,
  gimbal_pitch: -45,
  front_overlap: 75,
  side_overlap: 65,
  flight_direction: 0,
  pointToCenter: true,
};

function build(
  points: LatLng[],
  settings: GenerationSettings,
  center: LatLng | null,
  labelPrefix: string,
  actions: DraftAction[] = [{ action_type: "take_photo" }],
): DraftWaypoint[] {
  return points.map((p, i) => ({
    key: newWaypointKey(),
    sequence: i + 1,
    latitude: Number(p.latitude.toFixed(7)),
    longitude: Number(p.longitude.toFixed(7)),
    altitude_ft: settings.altitude_ft,
    heading:
      settings.pointToCenter && center
        ? Math.round(bearing(p, center))
        : Math.round(bearing(p, points[Math.min(i + 1, points.length - 1)] ?? p)),
    heading_mode: settings.pointToCenter && center ? ("center" as const) : ("path" as const),
    aim_lat: null,
    aim_lng: null,

    gimbal_pitch: settings.gimbal_pitch,
    speed_mph: settings.speed_mph,
    label: `${labelPrefix} ${String(i + 1).padStart(2, "0")}`,
    actions: actions.map((a) => ({ ...a })),
  }));
}

/** Repeatable documentation orbit around the site, plus two cross-site passes. */
export function generateProgressOrbit(
  ring: [number, number][],
  settings: GenerationSettings,
  orbitCount = 16,
): DraftWaypoint[] {
  const c = centroid(ring);
  const b = bounds(ring);
  const radLat = ((b.maxLat - b.minLat) / 2) * 1.15;
  const radLng = ((b.maxLng - b.minLng) / 2) * 1.15;
  const orbit: LatLng[] = [];
  for (let i = 0; i < orbitCount; i += 1) {
    const t = (2 * Math.PI * i) / orbitCount;
    orbit.push({ latitude: c.latitude + radLat * Math.cos(t), longitude: c.longitude + radLng * Math.sin(t) });
  }
  const cross: LatLng[] = [
    { latitude: b.minLat + (b.maxLat - b.minLat) * 0.25, longitude: c.longitude },
    { latitude: b.minLat + (b.maxLat - b.minLat) * 0.75, longitude: c.longitude },
    { latitude: c.latitude, longitude: b.minLng + (b.maxLng - b.minLng) * 0.25 },
    { latitude: c.latitude, longitude: b.minLng + (b.maxLng - b.minLng) * 0.75 },
  ];
  return build([...orbit, ...cross], settings, c, "Orbit");
}

/** Site perimeter: follows the boundary ring itself. */
export function generatePerimeter(
  ring: [number, number][],
  settings: GenerationSettings,
): DraftWaypoint[] {
  const c = centroid(ring);
  const unique = ring.filter(
    (p, i) => i === 0 || p[0] !== ring[i - 1]![0] || p[1] !== ring[i - 1]![1],
  );
  const densified: LatLng[] = [];
  for (let i = 0; i < unique.length - 1; i += 1) {
    const a = unique[i]!;
    const nxt = unique[i + 1]!;
    const steps = 3;
    for (let s = 0; s < steps; s += 1) {
      densified.push({
        latitude: a[1] + ((nxt[1] - a[1]) * s) / steps,
        longitude: a[0] + ((nxt[0] - a[0]) * s) / steps,
      });
    }
  }
  return build(densified, settings, c, "Perimeter");
}

/**
 * Mapping grid (lawnmower) derived from overlap settings.
 * Footprint model: 20MP 4/3 sensor, 24mm equivalent — planning approximation only.
 */
export function generateGrid(ring: [number, number][], settings: GenerationSettings): DraftWaypoint[] {
  const altM = settings.altitude_ft * FT_TO_M;
  const footprintWidth = altM * 1.13; // across-track ground width
  const footprintHeight = altM * 0.85; // along-track ground height
  const lineSpacing = Math.max(8, footprintWidth * (1 - settings.side_overlap / 100));
  const shotSpacing = Math.max(5, footprintHeight * (1 - settings.front_overlap / 100));

  const b = bounds(ring);
  const c = centroid(ring);
  const dLatLine = metersToDegLat(lineSpacing);
  const dLngShot = metersToDegLng(shotSpacing, c.latitude);
  const points: LatLng[] = [];
  const rows = Math.max(2, Math.ceil((b.maxLat - b.minLat) / dLatLine));
  for (let r = 0; r <= rows; r += 1) {
    const lat = b.minLat + r * dLatLine;
    if (lat > b.maxLat) break;
    const row: LatLng[] = [];
    for (let lng = b.minLng; lng <= b.maxLng; lng += dLngShot) {
      const p = { latitude: lat, longitude: lng };
      if (pointInRing(p, ring)) row.push(p);
    }
    if (row.length === 0) continue;
    const ends = [row[0]!, row[row.length - 1]!];
    const ordered = r % 2 === 0 ? ends : [ends[1]!, ends[0]!];
    points.push(...ordered);
  }
  const nadir = { ...settings, gimbal_pitch: -90, pointToCenter: false };
  return build(points, nadir, null, "Grid", [{ action_type: "take_photo" }]);
}

export function generateInspectionPoints(
  targets: { label: string; latitude: number; longitude: number }[],
  settings: GenerationSettings,
): DraftWaypoint[] {
  return targets.map((t, i) => ({
    key: newWaypointKey(),
    sequence: i + 1,
    latitude: t.latitude,
    longitude: t.longitude,
    altitude_ft: settings.altitude_ft,
    heading: null,
    gimbal_pitch: settings.gimbal_pitch,
    speed_mph: settings.speed_mph,
    label: t.label,
    actions: [{ action_type: "hover", param_numeric: 3 }, { action_type: "take_photo" }],
  }));
}

export function generateForType(
  type: MissionType,
  ring: [number, number][] | null,
  settings: GenerationSettings,
): DraftWaypoint[] {
  if (!ring || ring.length < 3) return [];
  switch (type) {
    case "weekly_progress":
      return generateProgressOrbit(ring, settings);
    case "site_perimeter":
      return generatePerimeter(ring, settings);
    case "mapping":
      return generateGrid(ring, settings);
    case "point_inspection": {
      const c = centroid(ring);
      const b = bounds(ring);
      return generateInspectionPoints(
        [
          { label: "Roof", latitude: c.latitude, longitude: c.longitude },
          { label: "Mechanical equipment", latitude: c.latitude + (b.maxLat - c.latitude) * 0.3, longitude: c.longitude },
          { label: "Facade", latitude: c.latitude, longitude: c.longitude + (b.maxLng - c.longitude) * 0.4 },
          { label: "Electrical yard", latitude: c.latitude - (c.latitude - b.minLat) * 0.4, longitude: c.longitude - (c.longitude - b.minLng) * 0.4 },
          { label: "Tower crane", latitude: c.latitude + (b.maxLat - c.latitude) * 0.15, longitude: c.longitude - (c.longitude - b.minLng) * 0.15 },
          { label: "Laydown yard", latitude: c.latitude - (c.latitude - b.minLat) * 0.6, longitude: c.longitude + (b.maxLng - c.longitude) * 0.5 },
        ],
        settings,
      );
    }
    default:
      return [];
  }
}

export interface FlightEstimate {
  distanceMeters: number;
  durationSeconds: number;
  areaSqMeters: number;
  waypointCount: number;
  photoCount: number;
  batteryPercent: number;
}

/**
 * Planning-only estimation. These are calculated projections, never a
 * guarantee of actual aircraft performance.
 */
export function estimateFlight(
  waypoints: DraftWaypoint[],
  opts: { speed_mph: number; ring?: [number, number][] | null; batteryMinutes?: number },
): FlightEstimate {
  const points = waypoints.map((w) => ({ latitude: w.latitude, longitude: w.longitude }));
  const distance = pathLengthMeters(points);
  const speedMs = Math.max(1, opts.speed_mph * MPH_TO_MS);
  const hoverSeconds = waypoints.reduce((sum, w) => {
    const hold = w.actions.reduce(
      (s, a) =>
        s +
        (a.action_type === "hover" || a.action_type === "wait" ? Number(a.param_numeric ?? 2) : 0) +
        (a.action_type === "take_photo" ? 1.5 : 0) +
        (a.action_type === "rotate_aircraft" || a.action_type === "rotate_gimbal" ? 2 : 0),
      0,
    );
    return sum + hold;
  }, 0);
  const transit = distance / speedMs;
  const duration = transit + hoverSeconds + 45; // takeoff, climb, RTH allowance
  const photoCount = waypoints.reduce(
    (s, w) => s + w.actions.filter((a) => a.action_type === "take_photo").length,
    0,
  );
  const batteryMinutes = opts.batteryMinutes ?? 35;
  const battery = Math.min(100, (duration / 60 / batteryMinutes) * 100 * 1.15);
  return {
    distanceMeters: distance,
    durationSeconds: duration,
    areaSqMeters: opts.ring ? ringAreaSqMeters(opts.ring) : 0,
    waypointCount: waypoints.length,
    photoCount,
    batteryPercent: Math.round(battery),
  };
}

export type ReadinessState = "READY" | "REVIEW_REQUIRED" | "BLOCKED";

export interface ReadinessCheck {
  key: string;
  label: string;
  severity: "blocking" | "review";
  passed: boolean;
  detail?: string;
}

export interface ReadinessInput {
  takeoffDefined: boolean;
  landingDefined: boolean;
  rthAltitudeFt: number | null;
  waypointCount: number;
  droneAssigned: boolean;
  pilotAssigned: boolean;
  settingsComplete: boolean;
  estimatedBatteryPercent: number;
  weatherReviewed: boolean;
  airspaceReviewed: boolean;
  preflightCompleted: boolean;
}

export function evaluateReadiness(input: ReadinessInput): {
  state: ReadinessState;
  checks: ReadinessCheck[];
} {
  const checks: ReadinessCheck[] = [
    { key: "takeoff", label: "Takeoff location defined", severity: "blocking", passed: input.takeoffDefined },
    { key: "landing", label: "Landing location defined", severity: "blocking", passed: input.landingDefined },
    {
      key: "rth",
      label: "Return-to-home altitude set",
      severity: "blocking",
      passed: (input.rthAltitudeFt ?? 0) > 0,
    },
    {
      key: "waypoints",
      label: "Valid waypoints",
      severity: "blocking",
      passed: input.waypointCount >= 2,
      detail: `${input.waypointCount} waypoint${input.waypointCount === 1 ? "" : "s"}`,
    },
    { key: "drone", label: "Drone assigned", severity: "blocking", passed: input.droneAssigned },
    { key: "pilot", label: "Pilot assigned", severity: "blocking", passed: input.pilotAssigned },
    {
      key: "settings",
      label: "Mission settings complete",
      severity: "blocking",
      passed: input.settingsComplete,
    },
    {
      key: "battery",
      label: "Estimated battery requirement within a single pack",
      severity: "review",
      passed: input.estimatedBatteryPercent <= 80,
      detail: `${input.estimatedBatteryPercent}% estimated`,
    },
    { key: "weather", label: "Weather reviewed", severity: "review", passed: input.weatherReviewed },
    { key: "airspace", label: "Airspace reviewed", severity: "review", passed: input.airspaceReviewed },
    {
      key: "preflight",
      label: "Preflight completed",
      severity: "review",
      passed: input.preflightCompleted,
    },
  ];
  const blocked = checks.some((c) => c.severity === "blocking" && !c.passed);
  const review = checks.some((c) => !c.passed);
  return { state: blocked ? "BLOCKED" : review ? "REVIEW_REQUIRED" : "READY", checks };
}
