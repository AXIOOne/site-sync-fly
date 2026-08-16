import { supabase } from "@/integrations/supabase/client";
import type { DraftWaypoint } from "./mission-planning";
import type { FlightEstimate } from "./mission-planning";
import type { Mission } from "./domain";

export interface SaveMissionInput {
  mission: Mission;
  settings: {
    name: string;
    altitude_ft: number;
    speed_mph: number;
    gimbal_pitch: number;
    camera_mode: string;
    photo_interval_seconds: number | null;
    aircraft_heading: string;
    rth_altitude_ft: number;
    front_overlap: number | null;
    side_overlap: number | null;
    flight_direction: number | null;
    drone_id: string | null;
    pilot_id: string | null;
    is_repeatable: boolean;
    repeat_frequency: Mission["repeat_frequency"];
    takeoff_lat: number | null;
    takeoff_lng: number | null;
    landing_lat: number | null;
    landing_lng: number | null;
    rth_lat: number | null;
    rth_lng: number | null;
    weather_reviewed: boolean;
    airspace_reviewed: boolean;
    readiness_state: string;
  };
  waypoints: DraftWaypoint[];
  estimate: FlightEstimate;
  changeNote: string;
  userId: string | null;
}

/**
 * Persists mission settings + waypoints and appends an immutable version
 * snapshot. Existing versions are never mutated, so historical flights keep
 * pointing at exactly the plan that was flown.
 */
export async function saveMissionVersion(input: SaveMissionInput) {
  const { mission, settings, waypoints, estimate, changeNote, userId } = input;
  const nextVersion = mission.current_version + 1;

  const { error: missionError } = await supabase
    .from("missions")
    .update({ ...settings, current_version: nextVersion })
    .eq("id", mission.id);
  if (missionError) throw new Error(missionError.message);

  const snapshot = {
    settings,
    waypoints: waypoints.map((w) => ({
      sequence: w.sequence,
      latitude: w.latitude,
      longitude: w.longitude,
      altitude_ft: w.altitude_ft,
      heading: w.heading,
      heading_mode: w.heading_mode,
      aim_lat: w.aim_lat ?? null,
      aim_lng: w.aim_lng ?? null,
      gimbal_pitch: w.gimbal_pitch,
      speed_mph: w.speed_mph,
      label: w.label,
      actions: withRotateBeforeCapture(w),
    })),
  };


  const { data: version, error: versionError } = await supabase
    .from("mission_versions")
    .insert({
      organization_id: mission.organization_id,
      mission_id: mission.id,
      version_number: nextVersion,
      change_note: changeNote || `Version ${nextVersion}`,
      snapshot: snapshot as unknown as import("@/integrations/supabase/types").Json,
      estimated_distance_m: Math.round(estimate.distanceMeters),
      estimated_duration_s: Math.round(estimate.durationSeconds),
      estimated_area_sq_m: Math.round(estimate.areaSqMeters),
      estimated_photo_count: estimate.photoCount,
      estimated_battery_percent: estimate.batteryPercent,
      waypoint_count: waypoints.length,
      created_by: userId,
    })
    .select()
    .single();
  if (versionError) throw new Error(versionError.message);

  // Replace the live waypoint set (history is preserved in the version snapshot).
  const { error: deleteError } = await supabase.from("waypoints").delete().eq("mission_id", mission.id);
  if (deleteError) throw new Error(deleteError.message);

  if (waypoints.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("waypoints")
      .insert(
        waypoints.map((w) => ({
          organization_id: mission.organization_id,
          mission_id: mission.id,
          sequence: w.sequence,
          latitude: w.latitude,
          longitude: w.longitude,
          altitude_ft: w.altitude_ft,
          heading: w.heading,
          gimbal_pitch: w.gimbal_pitch,
          speed_mph: w.speed_mph,
          label: w.label,
        })),
      )
      .select("id, sequence");
    if (insertError) throw new Error(insertError.message);

    const actionRows = waypoints.flatMap((w) => {
      const row = (inserted ?? []).find((r) => r.sequence === w.sequence);
      if (!row) return [];
      return w.actions.map((a, idx) => ({
        organization_id: mission.organization_id,
        waypoint_id: row.id,
        sequence: idx + 1,
        action_type: a.action_type,
        param_numeric: a.param_numeric ?? null,
      }));
    });
    if (actionRows.length > 0) {
      const { error: actionError } = await supabase.from("waypoint_actions").insert(actionRows);
      if (actionError) throw new Error(actionError.message);
    }
  }

  return version;
}

export async function upsertSchedule(input: {
  organizationId: string;
  projectId: string;
  missionId: string;
  scheduleId: string | null;
  frequency: "manual" | "daily" | "weekly" | "biweekly" | "monthly" | "custom";
  dayOfWeek: number | null;
  timeOfDay: string;
  isActive: boolean;
}) {
  const next = nextOccurrence(input.frequency, input.dayOfWeek, input.timeOfDay);
  const payload = {
    organization_id: input.organizationId,
    project_id: input.projectId,
    mission_id: input.missionId,
    frequency: input.frequency,
    day_of_week: input.dayOfWeek,
    time_of_day: input.timeOfDay,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    is_active: input.isActive,
    next_occurrence: next,
  };
  if (input.scheduleId) {
    const { error } = await supabase.from("flight_schedules").update(payload).eq("id", input.scheduleId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("flight_schedules").insert(payload);
    if (error) throw new Error(error.message);
  }
  return next;
}

export function nextOccurrence(
  frequency: string,
  dayOfWeek: number | null,
  timeOfDay: string,
): string | null {
  if (frequency === "manual") return null;
  const [h, m] = timeOfDay.split(":").map(Number);
  const date = new Date();
  date.setSeconds(0, 0);
  date.setHours(h ?? 9, m ?? 0);
  if (frequency === "daily") {
    if (date.getTime() < Date.now()) date.setDate(date.getDate() + 1);
    return date.toISOString();
  }
  const target = dayOfWeek ?? 2;
  const step = frequency === "biweekly" ? 14 : frequency === "monthly" ? 28 : 7;
  let delta = (target - date.getDay() + 7) % 7;
  if (delta === 0 && date.getTime() < Date.now()) delta = step;
  date.setDate(date.getDate() + delta);
  return date.toISOString();
}

export async function dispatchAssignment(input: {
  organizationId: string;
  projectId: string;
  missionId: string;
  missionVersionId: string | null;
  pilotId: string | null;
  droneId: string | null;
  scheduledFor: string;
  scheduleId?: string | null;
  notes?: string | null;
}) {
  const { data, error } = await supabase
    .from("flight_assignments")
    .insert({
      organization_id: input.organizationId,
      project_id: input.projectId,
      mission_id: input.missionId,
      mission_version_id: input.missionVersionId,
      pilot_id: input.pilotId,
      drone_id: input.droneId,
      schedule_id: input.scheduleId ?? null,
      scheduled_for: input.scheduledFor,
      status: "assigned",
      dispatched_to_agent: true,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createMission(input: {
  organizationId: string;
  projectId: string;
  name: string;
  missionType: Mission["mission_type"];
  isRepeatable: boolean;
  repeatFrequency: Mission["repeat_frequency"];
  takeoff: { latitude: number; longitude: number } | null;
}) {
  const { data, error } = await supabase
    .from("missions")
    .insert({
      organization_id: input.organizationId,
      project_id: input.projectId,
      name: input.name,
      mission_type: input.missionType,
      is_repeatable: input.isRepeatable,
      repeat_frequency: input.repeatFrequency,
      takeoff_lat: input.takeoff?.latitude ?? null,
      takeoff_lng: input.takeoff?.longitude ?? null,
      landing_lat: input.takeoff?.latitude ?? null,
      landing_lng: input.takeoff?.longitude ?? null,
      rth_lat: input.takeoff?.latitude ?? null,
      rth_lng: input.takeoff?.longitude ?? null,
      readiness_state: "BLOCKED",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
