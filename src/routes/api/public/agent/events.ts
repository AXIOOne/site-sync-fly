import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateDevice, json, loadOwnedFlight } from "@/lib/agent-api.server";

const EVENT_TYPES = [
  "AIRCRAFT_CONNECTED",
  "MISSION_DOWNLOADED",
  "PREFLIGHT_COMPLETE",
  "TAKEOFF",
  "MISSION_STARTED",
  "WAYPOINT_REACHED",
  "PHOTO_CAPTURED",
  "VIDEO_STARTED",
  "VIDEO_STOPPED",
  "LOW_BATTERY",
  "RETURN_TO_HOME",
  "LANDING",
  "MISSION_COMPLETE",
  "MISSION_ABORTED",
  "CONNECTION_LOST",
  "ERROR",
] as const;

const bodySchema = z.object({
  flight_id: z.string().uuid(),
  events: z
    .array(
      z.object({
        event_type: z.enum(EVENT_TYPES),
        message: z.string().max(400).optional(),
        waypoint_sequence: z.number().int().min(0).max(10_000).optional(),
        occurred_at: z.string().datetime().optional(),
        payload: z.record(z.unknown()).optional(),
      }),
    )
    .min(1)
    .max(200),
});

/** Flight event log ingestion (takeoff, waypoint reached, RTH, errors…). */
export const Route = createFileRoute("/api/public/agent/events")({
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

        const flight = await loadOwnedFlight(admin, device, body.flight_id);
        if (!flight) return json({ error: "Flight not found" }, 404);

        const { error } = await admin.from("flight_events").insert(
          body.events.map((event) => ({
            organization_id: device.organization_id,
            flight_id: flight.id,
            event_type: event.event_type,
            message: event.message ?? null,
            waypoint_sequence: event.waypoint_sequence ?? null,
            occurred_at: event.occurred_at ?? new Date().toISOString(),
            payload: (event.payload ?? null) as never,
            is_simulated: false,
          })),
        );
        if (error) return json({ error: "Ingestion failed" }, 500);

        return json({ accepted: body.events.length });
      },
    },
  },
});
