import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const issueSchema = z.object({
  deviceId: z.string().uuid().nullable().optional(),
  deviceName: z.string().min(2).max(80),
  deviceIdentifier: z.string().min(2).max(120),
  pilotId: z.string().uuid().nullable().optional(),
  droneId: z.string().uuid().nullable().optional(),
});

/**
 * Registers a Flight Agent device (or rotates an existing device's token) and
 * returns the plaintext token exactly once. Only the hash is persisted.
 */
export const issueDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => issueSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { generateDeviceToken } = await import("./agent-tokens.server");
    const { supabase } = context;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", context.userId)
      .single();
    if (profileError) throw new Error(profileError.message);

    const { token, hash, preview } = generateDeviceToken();

    if (data.deviceId) {
      const { data: updated, error } = await supabase
        .from("flight_agent_devices")
        .update({
          device_name: data.deviceName,
          device_identifier: data.deviceIdentifier,
          pilot_id: data.pilotId ?? null,
          assigned_drone_id: data.droneId ?? null,
          token_hash: hash,
          token_preview: preview,
          status: "active",
        })
        .eq("id", data.deviceId)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { token, deviceId: updated.id, rotated: true };
    }

    const { data: created, error } = await supabase
      .from("flight_agent_devices")
      .insert({
        organization_id: profile.organization_id,
        device_name: data.deviceName,
        device_identifier: data.deviceIdentifier,
        pilot_id: data.pilotId ?? null,
        assigned_drone_id: data.droneId ?? null,
        token_hash: hash,
        token_preview: preview,
        status: "active",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { token, deviceId: created.id, rotated: false };
  });

const statusSchema = z.object({
  deviceId: z.string().uuid(),
  status: z.enum(["active", "offline", "revoked", "update_required"]),
});

/** Revoking clears the stored hash so the token can never authenticate again. */
export const setDeviceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => statusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "revoked") {
      patch["token_hash"] = null;
      patch["token_preview"] = null;
    }
    const { error } = await context.supabase
      .from("flight_agent_devices")
      .update(patch)
      .eq("id", data.deviceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const roleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["administrator", "drone_program_manager", "project_manager", "pilot", "viewer"]),
});

/** Role changes are administrator-only and verified server side. */
export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => roleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "administrator",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Only administrators can change roles");

    const { data: actor, error: actorError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .single();
    if (actorError) throw new Error(actorError.message);

    const { data: target, error: targetError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", data.userId)
      .single();
    if (targetError) throw new Error(targetError.message);
    if (target.organization_id !== actor.organization_id) throw new Error("Member is not in your organization");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const del = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    if (del.error) throw new Error(del.error.message);
    const ins = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, organization_id: actor.organization_id, role: data.role });
    if (ins.error) throw new Error(ins.error.message);
    return { ok: true };
  });
