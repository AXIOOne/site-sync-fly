import type { Database } from "@/integrations/supabase/types";

export type Tables = Database["public"]["Tables"];
export type Project = Tables["projects"]["Row"];
export type ProjectBoundary = Tables["project_boundaries"]["Row"];
export type Drone = Tables["drones"]["Row"];
export type Pilot = Tables["pilots"]["Row"];
export type Mission = Tables["missions"]["Row"];
export type MissionVersion = Tables["mission_versions"]["Row"];
export type Waypoint = Tables["waypoints"]["Row"];
export type WaypointAction = Tables["waypoint_actions"]["Row"];
export type FlightSchedule = Tables["flight_schedules"]["Row"];
export type FlightAssignment = Tables["flight_assignments"]["Row"];
export type FlightAgentDevice = Tables["flight_agent_devices"]["Row"];
export type Flight = Tables["flights"]["Row"];
export type FlightEvent = Tables["flight_events"]["Row"];
export type FlightTelemetry = Tables["flight_telemetry"]["Row"];
export type MediaItem = Tables["media"]["Row"];
export type Report = Tables["reports"]["Row"];
export type Integration = Tables["integrations"]["Row"];
export type PreflightChecklist = Tables["preflight_checklists"]["Row"];
export type Organization = Tables["organizations"]["Row"];

export type AppRole = Database["public"]["Enums"]["app_role"];
export type DroneStatus = Database["public"]["Enums"]["drone_status"];
export type MissionType = Database["public"]["Enums"]["mission_type"];
export type FlightStatus = Database["public"]["Enums"]["flight_status"];
export type FlightResult = Database["public"]["Enums"]["flight_result"];
export type ScheduleFrequency = Database["public"]["Enums"]["schedule_frequency"];
export type WaypointActionType = Database["public"]["Enums"]["waypoint_action_type"];
export type FlightEventType = Database["public"]["Enums"]["flight_event_type"];
export type DeviceStatus = Database["public"]["Enums"]["device_status"];
export type IntegrationStatus = Database["public"]["Enums"]["integration_status"];

export type WaypointWithActions = Waypoint & { waypoint_actions: WaypointAction[] };

export const ROLE_LABELS: Record<AppRole, string> = {
  administrator: "Administrator",
  drone_program_manager: "Drone Program Manager",
  project_manager: "Project Manager",
  pilot: "Pilot",
  viewer: "Viewer",
};

export const MISSION_TYPE_LABELS: Record<MissionType, string> = {
  weekly_progress: "Weekly Construction Progress",
  mapping: "Mapping Mission",
  site_perimeter: "Site Perimeter",
  point_inspection: "Point Inspection",
  custom: "Custom Mission",
};

export const MISSION_TYPE_BLURB: Record<MissionType, string> = {
  weekly_progress: "Repeatable documentation orbit flown on a fixed cadence for owner reporting.",
  mapping: "Automatic lawnmower grid generated from a drawn polygon with overlap settings.",
  site_perimeter: "Follows the stored construction site boundary at a fixed offset.",
  point_inspection: "Targeted waypoints over specific assets: roof, mechanical, facade, crane.",
  custom: "Manual waypoint planning with full control over every position and action.",
};

export const DRONE_STATUS_LABELS: Record<DroneStatus, string> = {
  available: "AVAILABLE",
  assigned: "ASSIGNED",
  flying: "FLYING",
  charging: "CHARGING",
  maintenance: "MAINTENANCE",
  offline: "OFFLINE",
};

export const FLIGHT_STATUS_LABELS: Record<FlightStatus, string> = {
  scheduled: "SCHEDULED",
  assigned: "ASSIGNED",
  preflight: "PREFLIGHT",
  in_progress: "IN PROGRESS",
  completed: "COMPLETED",
  aborted: "ABORTED",
  failed: "FAILED",
};

export const FLIGHT_RESULT_LABELS: Record<FlightResult, string> = {
  completed: "COMPLETED",
  partial: "PARTIAL",
  aborted: "ABORTED",
  failed: "FAILED",
};

export const FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  manual: "Manual",
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every Two Weeks",
  monthly: "Monthly",
  custom: "Custom",
};

export const ACTION_LABELS: Record<WaypointActionType, string> = {
  take_photo: "TAKE PHOTO",
  start_video: "START VIDEO",
  stop_video: "STOP VIDEO",
  rotate_aircraft: "ROTATE AIRCRAFT",
  rotate_gimbal: "ROTATE GIMBAL",
  hover: "HOVER",
  wait: "WAIT",
  continue: "CONTINUE",
};

export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  active: "ACTIVE",
  offline: "OFFLINE",
  revoked: "REVOKED",
  update_required: "UPDATE REQUIRED",
};

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  not_connected: "NOT CONNECTED",
  connected: "CONNECTED",
  coming_soon: "COMING SOON",
  flight_agent_required: "FLIGHT AGENT REQUIRED",
  error: "ERROR",
};

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const PREFLIGHT_ITEMS = [
  { key: "aircraft_inspected", label: "Aircraft inspected" },
  { key: "propellers_inspected", label: "Propellers inspected" },
  { key: "battery_inspected", label: "Battery inspected" },
  { key: "weather_reviewed", label: "Weather reviewed" },
  { key: "airspace_reviewed", label: "Airspace reviewed" },
  { key: "takeoff_area_secure", label: "Takeoff area secure" },
  { key: "flight_path_reviewed", label: "Flight path reviewed" },
  { key: "rth_verified", label: "Return-to-home altitude verified" },
  { key: "authorization_confirmed", label: "Required authorization confirmed" },
] as const;

export interface PreflightItemState {
  key: string;
  label: string;
  checked: boolean;
}

export const INSPECTION_TARGETS = [
  "Roof",
  "Mechanical equipment",
  "Facade",
  "Electrical yard",
  "Tower crane",
  "Laydown yard",
] as const;

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDistanceMeters(m: number | null | undefined): string {
  if (m == null) return "—";
  return m >= 1609 ? `${(m / 1609.34).toFixed(2)} mi` : `${Math.round(m).toLocaleString()} m`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = value.length <= 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
