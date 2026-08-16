import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateDevice, json, loadOwnedFlight } from "@/lib/agent-api.server";

const startSchema = z.object({
  action: z.literal("start"),
  assignment_id: z.string().uuid(),
  battery_start: z.number().int().min(0).max(100).optional(),
});

const finishSchema = z.object({
  action: z.enum(["complete", "abort"]),
  flight_id: z.string().uuid(),
  duration_seconds: z.number().int().min(0).max(60 * 60 * 8).optional(),
  distance_m: z.number().min(0).max(500_000).optional(),
  max_altitude_ft: z.number().min(0).max(20_000).optional(),
  battery_end: z.number().int().min(0).max(100).optional(),
  completion_percent: z.number().min(0).max(100).optional(),
  reason: z.string().max(240).optional(),
});

const bodySchema = z.union([startSchema, finishSchema]);

/** Flight lifecycle for the agent: start a dispatched assignment, then complete or abort it. */
export const Route = createFileRoute("/api/public/agent/flights")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateDevice(request);
        if (auth instanceof Response) return auth;
        const { admin, device } = auth;

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return json({ error: "Invalid body" }, 400);
        }

        if (body.action === "start") {
          const { data: assignment, error } = await admin
            .from("flight_assignments")
            .select("*")
            .eq("id", body.assignment_id)
            .eq("organization_id", device.organization_id)
            .maybeSingle();
          if (error) return json({ error: "Query failed" }, 500);
          if (!assignment) return json({ error: "Assignment not found" }, 404);

          const startedAt = new Date().toISOString();
          const { data: flight, error: insertError } = await admin
            .from("flights")
            .insert({
              organization_id: device.organization_id,
              project_id: assignment.project_id,
              mission_id: assignment.mission_id,
              mission_version_id: assignment.mission_version_id,
              assignment_id: assignment.id,
              pilot_id: assignment.pilot_id ?? device.pilot_id,
              drone_id: assignment.drone_id ?? device.assigned_drone_id,
              device_id: device.id,
              scheduled_at: assignment.scheduled_for,
              started_at: startedAt,
              status: "in_progress",
              battery_start: body.battery_start ?? null,
              is_simulated: false,
            })
            .select("id")
            .single();
          if (insertError) return json({ error: "Could not start flight" }, 500);

          await admin
            .from("flight_assignments")
            .update({ status: "in_progress" })
            .eq("id", assignment.id);
          await admin.from("flight_events").insert({
            organization_id: device.organization_id,
            flight_id: flight.id,
            event_type: "MISSION_STARTED",
            message: `Mission started by ${device.device_name}`,
            is_simulated: false,
          });

          return json({ flight_id: flight.id, started_at: startedAt });
        }

        const flight = await loadOwnedFlight(admin, device, body.flight_id);
        if (!flight) return json({ error: "Flight not found" }, 404);

        const completed = body.action === "complete";
        const endedAt = new Date().toISOString();
        const { error: updateError } = await admin
          .from("flights")
          .update({
            status: completed ? "completed" : "aborted",
            result: completed ? "completed" : "aborted",
            ended_at: endedAt,
            duration_seconds: body.duration_seconds ?? null,
            distance_m: body.distance_m ?? null,
            max_altitude_ft: body.max_altitude_ft ?? null,
            battery_end: body.battery_end ?? null,
            completion_percent: body.completion_percent ?? (completed ? 100 : 0),
          })
          .eq("id", flight.id);
        if (updateError) return json({ error: "Could not finalize flight" }, 500);

        await admin.from("flight_events").insert({
          organization_id: device.organization_id,
          flight_id: flight.id,
          event_type: completed ? "MISSION_COMPLETE" : "MISSION_ABORTED",
          message: body.reason ?? null,
          is_simulated: false,
        });

        const { data: assignmentRow } = await admin
          .from("flights")
          .select("assignment_id")
          .eq("id", flight.id)
          .maybeSingle();
        if (assignmentRow?.assignment_id) {
          await admin
            .from("flight_assignments")
            .update({ status: completed ? "completed" : "aborted" })
            .eq("id", assignmentRow.assignment_id);
        }

        return json({ flight_id: flight.id, status: completed ? "completed" : "aborted", ended_at: endedAt });
      },
    },
  },
});
