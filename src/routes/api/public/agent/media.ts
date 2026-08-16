import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateDevice, json, loadOwnedFlight } from "@/lib/agent-api.server";

const bodySchema = z.object({
  flight_id: z.string().uuid(),
  items: z
    .array(
      z.object({
        media_type: z.enum(["photo", "video", "orthomosaic", "model_3d", "point_cloud"]),
        file_url: z.string().url().max(1000).optional(),
        thumbnail_url: z.string().url().max(1000).optional(),
        captured_at: z.string().datetime().optional(),
        waypoint_sequence: z.number().int().min(0).max(10_000).optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
        altitude_ft: z.number().min(-500).max(20_000).optional(),
        heading: z.number().min(0).max(360).optional(),
        gimbal_pitch: z.number().min(-120).max(60).optional(),
        aircraft: z.string().max(80).optional(),
        camera: z.string().max(80).optional(),
        file_size_bytes: z.number().int().min(0).max(50_000_000_000).optional(),
      }),
    )
    .min(1)
    .max(200),
});

/** Registers captures against a flight. Binary upload happens separately to storage. */
export const Route = createFileRoute("/api/public/agent/media")({
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

        const { error } = await admin.from("media").insert(
          body.items.map((item) => ({
            organization_id: device.organization_id,
            project_id: flight.project_id,
            mission_id: flight.mission_id,
            flight_id: flight.id,
            media_type: item.media_type,
            file_url: item.file_url ?? null,
            thumbnail_url: item.thumbnail_url ?? null,
            captured_at: item.captured_at ?? new Date().toISOString(),
            waypoint_sequence: item.waypoint_sequence ?? null,
            latitude: item.latitude ?? null,
            longitude: item.longitude ?? null,
            altitude_ft: item.altitude_ft ?? null,
            heading: item.heading ?? null,
            gimbal_pitch: item.gimbal_pitch ?? null,
            aircraft: item.aircraft ?? null,
            camera: item.camera ?? null,
            file_size_bytes: item.file_size_bytes ?? null,
          })),
        );
        if (error) return json({ error: "Ingestion failed" }, 500);

        const photos = body.items.filter((i) => i.media_type === "photo").length;
        const videos = body.items.filter((i) => i.media_type === "video").length;
        await admin
          .from("flights")
          .update({
            photos_captured: (flight.photos_captured ?? 0) + photos,
            videos_captured: (flight.videos_captured ?? 0) + videos,
          })
          .eq("id", flight.id);

        return json({ accepted: body.items.length });
      },
    },
  },
});
