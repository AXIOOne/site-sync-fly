import { hashDeviceToken } from "./agent-tokens.server";

export interface AgentDevice {
  id: string;
  organization_id: string;
  device_name: string;
  device_identifier: string;
  pilot_id: string | null;
  assigned_drone_id: string | null;
  status: string;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}

/**
 * Authenticates a Flight Agent request by device token. Tokens are compared as
 * SHA-256 hashes; revoked devices have no hash and can never authenticate.
 * Returns either the device or a Response to return immediately.
 */
export async function authenticateDevice(
  request: Request,
): Promise<{ device: AgentDevice; admin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"] } | Response> {
  const token = bearerToken(request);
  if (!token) return json({ error: "Missing device token" }, 401);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("flight_agent_devices")
    .select("id, organization_id, device_name, device_identifier, pilot_id, assigned_drone_id, status")
    .eq("token_hash", hashDeviceToken(token))
    .maybeSingle();

  if (error) return json({ error: "Authentication failed" }, 500);
  if (!data) return json({ error: "Invalid device token" }, 401);
  if (data.status === "revoked") return json({ error: "Device revoked" }, 403);

  await supabaseAdmin
    .from("flight_agent_devices")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", data.id);

  return { device: data as AgentDevice, admin: supabaseAdmin };
}

/** Confirms a flight belongs to the authenticated device's organization. */
export async function loadOwnedFlight(
  admin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  device: AgentDevice,
  flightId: string,
) {
  const { data, error } = await admin
    .from("flights")
    .select("id, organization_id, mission_id, project_id, status, photos_captured, videos_captured")
    .eq("id", flightId)
    .eq("organization_id", device.organization_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
