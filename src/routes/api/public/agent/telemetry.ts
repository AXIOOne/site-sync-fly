import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateDevice, json, loadOwnedFlight } from "@/lib/agent-api.server";

const sampleSchema = z.object({
  recorded_at: z.string().datetime().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  altitude_ft: z.number().min(-500).max(20_000).optional(),
  speed_mph: z.number().min(0).max(200).optional(),
  heading: z.number().min(0).max(360).optional(),
  battery_percent: z.number().int().min(0).max(100).optional(),
  satellite_count: z.number().int().min(0).max(60).optional(),
  current_waypoint: z.number().int().min(0).max(10_000).optional(),
  flight_mode: z.string().max(40).optional(),
  distance_from_home_m: z.number().min(0).max(100_000).optional(),
  mission_progress: z.number().min(0).max(100).optional(),
});

const bodySchema = z.object({
  flight_id: z.string().uuid(),
  samples: z.array(sampleSchema).min(1).max(600),
});

/** Batched 1 Hz telemetry ingestion from the Flight Agent. */
export const Route = createFileRoute("/api/public/agent/telemetry")({
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

        const now = Date.now();
        const rows = body.samples.map((sample, index) => ({
          organization_id: device.organization_id,
          flight_id: flight.id,
          recorded_at: sample.recorded_at ?? new Date(now + index).toISOString(),
          latitude: sample.latitude ?? null,
          longitude: sample.longitude ?? null,
          altitude_ft: sample.altitude_ft ?? null,
          speed_mph: sample.speed_mph ?? null,
          heading: sample.heading ?? null,
          battery_percent: sample.battery_percent ?? null,
          satellite_count: sample.satellite_count ?? null,
          current_waypoint: sample.current_waypoint ?? null,
          flight_mode: sample.flight_mode ?? null,
          distance_from_home_m: sample.distance_from_home_m ?? null,
          mission_progress: sample.mission_progress ?? null,
          is_simulated: false,
        }));

        const { error } = await admin.from("flight_telemetry").insert(rows);
        if (error) return json({ error: "Ingestion failed" }, 500);

        const last = body.samples[body.samples.length - 1];
        if (last?.mission_progress != null) {
          await admin
            .from("flights")
            .update({ completion_percent: last.mission_progress })
            .eq("id", flight.id);
        }

        return json({ accepted: rows.length });
      },
    },
  },
});
