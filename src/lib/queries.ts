import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const projectsQuery = () =>
  queryOptions({
    queryKey: ["projects"],
    queryFn: () => unwrap(supabase.from("projects").select("*").order("created_at", { ascending: false })),
  });

export const projectQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).single();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const boundariesQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["boundaries", projectId],
    queryFn: () => unwrap(supabase.from("project_boundaries").select("*").eq("project_id", projectId)),
  });

export const poisQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["pois", projectId],
    queryFn: () =>
      unwrap(
        supabase
          .from("points_of_interest")
          .select("*")
          .eq("project_id", projectId)
          .order("label"),
      ),
  });

export const dronesQuery = () =>
  queryOptions({
    queryKey: ["drones"],
    queryFn: () => unwrap(supabase.from("drones").select("*").order("model")),
  });

export const pilotsQuery = () =>
  queryOptions({
    queryKey: ["pilots"],
    queryFn: () => unwrap(supabase.from("pilots").select("*").order("full_name")),
  });

export const missionsQuery = (projectId?: string) =>
  queryOptions({
    queryKey: ["missions", projectId ?? "all"],
    queryFn: () => {
      let q = supabase.from("missions").select("*").order("created_at", { ascending: false });
      if (projectId) q = q.eq("project_id", projectId);
      return unwrap(q);
    },
  });

export const missionQuery = (missionId: string) =>
  queryOptions({
    queryKey: ["mission", missionId],
    queryFn: async () => {
      const { data, error } = await supabase.from("missions").select("*").eq("id", missionId).single();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const missionVersionsQuery = (missionId: string) =>
  queryOptions({
    queryKey: ["mission-versions", missionId],
    queryFn: () =>
      unwrap(
        supabase
          .from("mission_versions")
          .select("*")
          .eq("mission_id", missionId)
          .order("version_number", { ascending: false }),
      ),
  });

export const waypointsQuery = (missionId: string) =>
  queryOptions({
    queryKey: ["waypoints", missionId],
    queryFn: () =>
      unwrap(
        supabase
          .from("waypoints")
          .select("*, waypoint_actions(*)")
          .eq("mission_id", missionId)
          .order("sequence"),
      ),
  });

export const flightsQuery = (filters: { projectId?: string; missionId?: string; limit?: number } = {}) =>
  queryOptions({
    queryKey: ["flights", filters],
    queryFn: () => {
      let q = supabase
        .from("flights")
        .select("*, missions(name, mission_type), projects(name), pilots(full_name), drones(model, manufacturer)")
        .order("scheduled_at", { ascending: false })
        .limit(filters.limit ?? 100);
      if (filters.projectId) q = q.eq("project_id", filters.projectId);
      if (filters.missionId) q = q.eq("mission_id", filters.missionId);
      return unwrap(q);
    },
  });

export const flightQuery = (flightId: string) =>
  queryOptions({
    queryKey: ["flight", flightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flights")
        .select("*, missions(*), projects(*), pilots(*), drones(*)")
        .eq("id", flightId)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const flightEventsQuery = (flightId: string) =>
  queryOptions({
    queryKey: ["flight-events", flightId],
    queryFn: () =>
      unwrap(supabase.from("flight_events").select("*").eq("flight_id", flightId).order("occurred_at")),
  });

export const telemetryQuery = (flightId: string) =>
  queryOptions({
    queryKey: ["telemetry", flightId],
    queryFn: () =>
      unwrap(supabase.from("flight_telemetry").select("*").eq("flight_id", flightId).order("recorded_at")),
  });

export const mediaQuery = (filters: { projectId?: string; flightId?: string; missionId?: string } = {}) =>
  queryOptions({
    queryKey: ["media", filters],
    queryFn: () => {
      let q = supabase
        .from("media")
        .select("*, missions(name), flights(started_at)")
        .order("captured_at", { ascending: false })
        .limit(400);
      if (filters.projectId) q = q.eq("project_id", filters.projectId);
      if (filters.flightId) q = q.eq("flight_id", filters.flightId);
      if (filters.missionId) q = q.eq("mission_id", filters.missionId);
      return unwrap(q);
    },
  });

export const schedulesQuery = (projectId?: string) =>
  queryOptions({
    queryKey: ["schedules", projectId ?? "all"],
    queryFn: () => {
      let q = supabase
        .from("flight_schedules")
        .select("*, missions(name), projects(name)")
        .order("next_occurrence");
      if (projectId) q = q.eq("project_id", projectId);
      return unwrap(q);
    },
  });

export const assignmentsQuery = (projectId?: string) =>
  queryOptions({
    queryKey: ["assignments", projectId ?? "all"],
    queryFn: () => {
      let q = supabase
        .from("flight_assignments")
        .select("*, missions(name, mission_type), projects(name), pilots(full_name), drones(model)")
        .order("scheduled_for");
      if (projectId) q = q.eq("project_id", projectId);
      return unwrap(q);
    },
  });

export const devicesQuery = () =>
  queryOptions({
    queryKey: ["devices"],
    queryFn: () =>
      unwrap(
        supabase
          .from("flight_agent_devices")
          .select("*, pilots(full_name), drones(model)")
          .order("created_at"),
      ),
  });

export const integrationsQuery = () =>
  queryOptions({
    queryKey: ["integrations"],
    queryFn: () => unwrap(supabase.from("integrations").select("*").order("provider")),
  });

export const reportsQuery = (projectId?: string) =>
  queryOptions({
    queryKey: ["reports", projectId ?? "all"],
    queryFn: () => {
      let q = supabase
        .from("reports")
        .select("*, projects(name), flights(started_at)")
        .order("created_at", { ascending: false });
      if (projectId) q = q.eq("project_id", projectId);
      return unwrap(q);
    },
  });

export const organizationQuery = () =>
  queryOptions({
    queryKey: ["organization"],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("*").limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const membersQuery = () =>
  queryOptions({
    queryKey: ["members"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profiles.error) throw new Error(profiles.error.message);
      if (roles.error) throw new Error(roles.error.message);
      return (profiles.data ?? []).map((profile) => ({
        ...profile,
        roles: (roles.data ?? []).filter((r) => r.user_id === profile.id).map((r) => r.role),
      }));
    },
  });

export const checklistQuery = (flightId: string) =>
  queryOptions({
    queryKey: ["checklist", flightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preflight_checklists")
        .select("*")
        .eq("flight_id", flightId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const assignmentQuery = (assignmentId: string) =>
  queryOptions({
    queryKey: ["assignment", assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flight_assignments")
        .select("*, missions(*), projects(*), pilots(*), drones(*)")
        .eq("id", assignmentId)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const reportQuery = (reportId: string) =>
  queryOptions({
    queryKey: ["report", reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*, projects(*), flights(*, missions(name), pilots(full_name), drones(model, manufacturer))")
        .eq("id", reportId)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  });
