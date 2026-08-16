import { bearing, haversineMeters, MPH_TO_MS, type LatLng } from "../geo";
import type { DraftWaypoint } from "../mission-planning";

export interface SimulatorLeg {
  from: LatLng;
  to: LatLng;
  distanceMeters: number;
  heading: number;
  targetWaypoint: number;
}

export interface SimulatorState {
  elapsedSeconds: number;
  latitude: number;
  longitude: number;
  altitudeFt: number;
  speedMph: number;
  heading: number;
  batteryPercent: number;
  satelliteCount: number;
  currentWaypoint: number;
  flightMode: string;
  distanceFromHomeM: number;
  missionProgress: number;
  distanceTravelledM: number;
  photos: number;
  finished: boolean;
  /** Waypoint sequence reached on this tick, if any. */
  reachedWaypoint: number | null;
  capturedPhotoAt: number | null;
}

/**
 * Deterministic mission simulator. It replays the planned route at the planned
 * speed to produce plausible telemetry for demos and dry runs. Output is
 * always flagged as simulated — it is never DJI aircraft data.
 */
export class FlightSimulator {
  private legs: SimulatorLeg[] = [];
  private legIndex = 0;
  private legProgressM = 0;
  private elapsed = 0;
  private photos = 0;
  private travelled = 0;
  private readonly totalDistance: number;
  private readonly home: LatLng;

  constructor(
    private readonly waypoints: DraftWaypoint[],
    private readonly options: {
      speedMph: number;
      batteryMinutes: number;
      home: LatLng;
      photoAtWaypoint: boolean;
    },
  ) {
    this.home = options.home;
    const points: LatLng[] = [
      options.home,
      ...waypoints.map((w) => ({ latitude: w.latitude, longitude: w.longitude })),
      options.home,
    ];
    for (let i = 0; i < points.length - 1; i += 1) {
      const from = points[i]!;
      const to = points[i + 1]!;
      this.legs.push({
        from,
        to,
        distanceMeters: haversineMeters(from, to),
        heading: bearing(from, to),
        targetWaypoint: i === points.length - 2 ? 0 : i + 1,
      });
    }
    this.totalDistance = this.legs.reduce((s, l) => s + l.distanceMeters, 0);
  }

  get totalDistanceMeters() {
    return this.totalDistance;
  }

  /** Advance the simulation by `dt` seconds. */
  tick(dt: number, speedMultiplier = 1): SimulatorState {
    const speedMs = Math.max(1, this.options.speedMph * MPH_TO_MS) * speedMultiplier;
    this.elapsed += dt * speedMultiplier;
    let remaining = speedMs * dt;
    let reached: number | null = null;

    while (remaining > 0 && this.legIndex < this.legs.length) {
      const leg = this.legs[this.legIndex]!;
      const left = leg.distanceMeters - this.legProgressM;
      if (remaining >= left) {
        remaining -= left;
        this.travelled += left;
        this.legIndex += 1;
        this.legProgressM = 0;
        reached = leg.targetWaypoint || null;
        if (reached && this.options.photoAtWaypoint) this.photos += 1;
      } else {
        this.legProgressM += remaining;
        this.travelled += remaining;
        remaining = 0;
      }
    }

    const finished = this.legIndex >= this.legs.length;
    const leg = this.legs[Math.min(this.legIndex, this.legs.length - 1)]!;
    const t = leg.distanceMeters === 0 ? 1 : this.legProgressM / leg.distanceMeters;
    const position = finished
      ? this.home
      : {
          latitude: leg.from.latitude + (leg.to.latitude - leg.from.latitude) * t,
          longitude: leg.from.longitude + (leg.to.longitude - leg.from.longitude) * t,
        };

    const nextWaypoint = this.waypoints[Math.min(Math.max(this.legIndex - 1, 0), this.waypoints.length - 1)];
    const altitude = finished ? 0 : Number(nextWaypoint?.altitude_ft ?? 150);
    const batteryDrain = (this.elapsed / 60 / this.options.batteryMinutes) * 100;

    return {
      elapsedSeconds: this.elapsed,
      latitude: position.latitude,
      longitude: position.longitude,
      altitudeFt: altitude,
      speedMph: finished ? 0 : this.options.speedMph,
      heading: leg.heading,
      batteryPercent: Math.max(5, Math.round(100 - batteryDrain * 1.15)),
      satelliteCount: 16 + ((Math.floor(this.elapsed) % 5) - 2),
      currentWaypoint: Math.min(this.legIndex, this.waypoints.length),
      flightMode: finished
        ? "LANDED"
        : this.legIndex === 0
          ? "TAKEOFF"
          : this.legIndex >= this.legs.length - 1
            ? "RETURN_TO_HOME"
            : "WAYPOINT",
      distanceFromHomeM: haversineMeters(this.home, position),
      missionProgress: this.totalDistance === 0 ? 100 : Math.min(100, (this.travelled / this.totalDistance) * 100),
      distanceTravelledM: this.travelled,
      photos: this.photos,
      finished,
      reachedWaypoint: reached,
      capturedPhotoAt: reached && this.options.photoAtWaypoint ? reached : null,
    };
  }
}
