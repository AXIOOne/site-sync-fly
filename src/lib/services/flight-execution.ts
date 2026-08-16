import { supabase } from "@/integrations/supabase/client";
import type { FlightEventType, FlightResult } from "../domain";

export interface CreateFlightInput {
  organizationId: string;
  projectId: string;
  missionId: string;
  missionVersionId: string | null;
  assignmentId?: string | null;
  pilotId: string | null;
  droneId: string | null;
  deviceId?: string | null;
  scheduledAt?: string | null;
  isSimulated: boolean;
  batteryStart?: number | null;
}

export const FlightExecutionService = {
  async createFlight(input: CreateFlightInput) {
    const { data, error } = await supabase
      .from("flights")
      .insert({
        organization_id: input.organizationId,
        project_id: input.projectId,
        mission_id: input.missionId,
        mission_version_id: input.missionVersionId,
        assignment_id: input.assignmentId ?? null,
        pilot_id: input.pilotId,
        drone_id: input.droneId,
        device_id: input.deviceId ?? null,
        scheduled_at: input.scheduledAt ?? new Date().toISOString(),
        status: "preflight",
        is_simulated: input.isSimulated,
        battery_start: input.batteryStart ?? 100,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async start(flightId: string, organizationId: string, isSimulated: boolean) {
    const startedAt = new Date().toISOString();
    const { error } = await supabase
      .from("flights")
      .update({ status: "in_progress", started_at: startedAt })
      .eq("id", flightId);
    if (error) throw error;
    await this.recordEvent({
      flightId,
      organizationId,
      eventType: "MISSION_STARTED",
      message: isSimulated ? "Simulated mission started (SIMULATION MODE)" : "Mission started",
      isSimulated,
    });
    return startedAt;
  },

  async recordEvent(input: {
    flightId: string;
    organizationId: string;
    eventType: FlightEventType;
    message?: string;
    waypointSequence?: number | null;
    isSimulated?: boolean;
  }) {
    const { error } = await supabase.from("flight_events").insert({
      organization_id: input.organizationId,
      flight_id: input.flightId,
      event_type: input.eventType,
      message: input.message ?? null,
      waypoint_sequence: input.waypointSequence ?? null,
      is_simulated: input.isSimulated ?? false,
    });
    if (error) throw error;
  },

  async complete(input: {
    flightId: string;
    organizationId: string;
    durationSeconds: number;
    distanceMeters: number;
    maxAltitudeFt: number;
    photos: number;
    videos?: number;
    batteryEnd: number;
    completionPercent: number;
    result: FlightResult;
    isSimulated: boolean;
  }) {
    const { error } = await supabase
      .from("flights")
      .update({
        status: input.result === "completed" ? "completed" : input.result === "partial" ? "completed" : "aborted",
        result: input.result,
        ended_at: new Date().toISOString(),
        duration_seconds: Math.round(input.durationSeconds),
        distance_m: Math.round(input.distanceMeters),
        max_altitude_ft: input.maxAltitudeFt,
        photos_captured: input.photos,
        videos_captured: input.videos ?? 0,
        battery_end: input.batteryEnd,
        completion_percent: input.completionPercent,
      })
      .eq("id", input.flightId);
    if (error) throw error;
    await this.recordEvent({
      flightId: input.flightId,
      organizationId: input.organizationId,
      eventType: input.result === "completed" ? "MISSION_COMPLETE" : "MISSION_ABORTED",
      message:
        input.result === "completed"
          ? `Mission complete • ${input.photos} photos`
          : `Mission ended at ${input.completionPercent}% completion`,
      isSimulated: input.isSimulated,
    });
  },

  async abort(flightId: string, organizationId: string, completionPercent: number, isSimulated: boolean) {
    const { error } = await supabase
      .from("flights")
      .update({
        status: "aborted",
        result: "aborted",
        ended_at: new Date().toISOString(),
        completion_percent: completionPercent,
      })
      .eq("id", flightId);
    if (error) throw error;
    await this.recordEvent({
      flightId,
      organizationId,
      eventType: "MISSION_ABORTED",
      message: "Mission aborted by operator",
      isSimulated,
    });
  },
};

export interface TelemetrySample {
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
}

/**
 * Telemetry ingestion with configurable sampling so high-frequency aircraft
 * telemetry is not persisted indefinitely.
 */
export class TelemetryService {
  private lastWriteMs = 0;

  constructor(
    private readonly organizationId: string,
    private readonly flightId: string,
    private readonly sampleSeconds: number,
    private readonly isSimulated: boolean,
  ) {}

  shouldPersist(nowMs = Date.now()): boolean {
    return nowMs - this.lastWriteMs >= this.sampleSeconds * 1000;
  }

  async ingest(sample: TelemetrySample, force = false) {
    const now = Date.now();
    if (!force && !this.shouldPersist(now)) return false;
    this.lastWriteMs = now;
    const { error } = await supabase.from("flight_telemetry").insert({
      organization_id: this.organizationId,
      flight_id: this.flightId,
      recorded_at: new Date(now).toISOString(),
      latitude: sample.latitude,
      longitude: sample.longitude,
      altitude_ft: sample.altitudeFt,
      speed_mph: sample.speedMph,
      heading: sample.heading,
      battery_percent: sample.batteryPercent,
      satellite_count: sample.satelliteCount,
      current_waypoint: sample.currentWaypoint,
      flight_mode: sample.flightMode,
      distance_from_home_m: Math.round(sample.distanceFromHomeM),
      mission_progress: sample.missionProgress,
      is_simulated: this.isSimulated,
    });
    if (error) throw error;
    return true;
  }
}

export const MediaIngestionService = {
  async attach(input: {
    organizationId: string;
    projectId: string;
    missionId: string;
    flightId: string;
    waypointSequence: number;
    latitude: number;
    longitude: number;
    altitudeFt: number;
    heading: number | null;
    gimbalPitch: number | null;
    aircraft: string | null;
    camera: string | null;
    fileUrl: string;
    capturedAt?: string;
  }) {
    const { error } = await supabase.from("media").insert({
      organization_id: input.organizationId,
      project_id: input.projectId,
      mission_id: input.missionId,
      flight_id: input.flightId,
      waypoint_sequence: input.waypointSequence,
      media_type: "photo",
      file_url: input.fileUrl,
      thumbnail_url: input.fileUrl,
      captured_at: input.capturedAt ?? new Date().toISOString(),
      latitude: input.latitude,
      longitude: input.longitude,
      altitude_ft: input.altitudeFt,
      heading: input.heading,
      gimbal_pitch: input.gimbalPitch,
      aircraft: input.aircraft,
      camera: input.camera,
    });
    if (error) throw error;
  },
};

/** Placeholder imagery used only for simulated captures. */
export const SIMULATED_CAPTURE_IMAGES = [
  "/demo/site-early.jpg",
  "/demo/site-earthwork.jpg",
  "/demo/site-roof.jpg",
  "/demo/site-late.jpg",
];
