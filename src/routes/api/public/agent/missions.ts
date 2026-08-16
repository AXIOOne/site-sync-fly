import { createFileRoute } from "@tanstack/react-router";
import { authenticateDevice, json } from "@/lib/agent-api.server";
import { DJIMissionService, MissionPackageService } from "@/lib/services/mission-package";

/**
 * Lists dispatched assignments for the authenticated device's organization.
 * `?assignment_id=` returns a single assignment with the full mission package
 * (standardized JSON) plus generated DJI WPML.
 */
export const Route = createFileRoute("/api/public/agent/missions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateDevice(request);
        if (auth instanceof Response) return auth;
        const { admin, device } = auth;

        const url = new URL(request.url);
        const assignmentId = url.searchParams.get("assignment_id");

        let query = admin
          .from("flight_assignments")
          .select(
            "id, scheduled_for, status, notes, mission_id, mission_version_id, project_id, pilot_id, drone_id, missions(name, mission_type), projects(name)",
          )
          .eq("organization_id", device.organization_id)
          .eq("dispatched_to_agent", true)
          .in("status", ["assigned", "preflight", "scheduled"])
          .order("scheduled_for");

        if (assignmentId) query = query.eq("id", assignmentId);

        const { data: assignments, error } = await query;
        if (error) return json({ error: "Query failed" }, 500);

        if (!assignmentId) {
          return json({
            assignments: (assignments ?? []).map((a: any) => ({
              id: a.id,
              scheduled_for: a.scheduled_for,
              status: a.status,
              mission: { id: a.mission_id, name: a.missions?.name, type: a.missions?.mission_type },
              project: { id: a.project_id, name: a.projects?.name },
              package_url: `/api/public/agent/missions?assignment_id=${a.id}`,
            })),
          });
        }

        const assignment = (assignments ?? [])[0] as any;
        if (!assignment) return json({ error: "Assignment not found" }, 404);

        const [mission, project, version, waypoints, drone, pilot] = await Promise.all([
          admin.from("missions").select("*").eq("id", assignment.mission_id).single(),
          admin.from("projects").select("*").eq("id", assignment.project_id).single(),
          assignment.mission_version_id
            ? admin.from("mission_versions").select("*").eq("id", assignment.mission_version_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          admin
            .from("waypoints")
            .select("*, waypoint_actions(sequence, action_type, param_numeric, param_text)")
            .eq("mission_id", assignment.mission_id)
            .order("sequence"),
          assignment.drone_id
            ? admin.from("drones").select("*").eq("id", assignment.drone_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          assignment.pilot_id
            ? admin.from("pilots").select("*").eq("id", assignment.pilot_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (mission.error || project.error || waypoints.error) return json({ error: "Package build failed" }, 500);

        const pkg = MissionPackageService.build({
          mission: mission.data as any,
          version: (version.data ?? null) as any,
          project: project.data as any,
          drone: (drone.data ?? null) as any,
          pilot: (pilot.data ?? null) as any,
          waypoints: (waypoints.data ?? []).map((w: any) => ({
            sequence: w.sequence,
            latitude: w.latitude,
            longitude: w.longitude,
            altitude_ft: w.altitude_ft,
            heading: w.heading,
            gimbal_pitch: w.gimbal_pitch,
            speed_mph: w.speed_mph,
            label: w.label,
            actions: w.waypoint_actions ?? [],
          })),
        });

        return json({
          assignment: {
            id: assignment.id,
            scheduled_for: assignment.scheduled_for,
            status: assignment.status,
            notes: assignment.notes,
          },
          ...DJIMissionService.buildAgentPayload(pkg),
        });
      },
    },
  },
});
