import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateDevice, json } from "@/lib/agent-api.server";

const bodySchema = z.object({
  device_identifier: z.string().min(2).max(120),
  device_name: z.string().min(2).max(80).optional(),
  app_version: z.string().max(40).optional(),
});

/**
 * The agent calls this once after the operator pastes the device token issued in
 * Settings. It binds the hardware identifier and agent build to the device row.
 */
export const Route = createFileRoute("/api/public/agent/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateDevice(request);
        if (auth instanceof Response) return auth;

        let parsed;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return json({ error: "Invalid body" }, 400);
        }

        const { error } = await auth.admin
          .from("flight_agent_devices")
          .update({
            device_identifier: parsed.device_identifier,
            ...(parsed.device_name ? { device_name: parsed.device_name } : {}),
            ...(parsed.app_version ? { app_version: parsed.app_version } : {}),
            status: "active",
          })
          .eq("id", auth.device.id);
        if (error) return json({ error: "Registration failed" }, 500);

        return json({
          device: {
            id: auth.device.id,
            name: parsed.device_name ?? auth.device.device_name,
            pilot_id: auth.device.pilot_id,
            assigned_drone_id: auth.device.assigned_drone_id,
          },
          telemetry_sample_seconds: 1,
          note: "Aircraft control is performed by the agent using DJI Mobile SDK 5. This API only exchanges data.",
        });
      },
    },
  },
});
