import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell, LoadingPanel, Metric, Panel } from "@/components/app-shell";
import { StatusChip, toneForDevice } from "@/components/status-chip";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useWorkspace } from "@/hooks/useSession";
import { devicesQuery, dronesQuery, membersQuery, organizationQuery, pilotsQuery } from "@/lib/queries";
import { DEVICE_STATUS_LABELS, ROLE_LABELS, formatDateTime } from "@/lib/domain";
import type { AppRole } from "@/lib/domain";
import { issueDeviceToken, setDeviceStatus, setMemberRole } from "@/lib/agent.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Workspace Settings — SiteView Missions" },
      {
        name: "description",
        content:
          "Manage the organization, member roles, telemetry sampling and the Flight Agent device tokens used by the DJI Android agent.",
      },
      { property: "og:title", content: "Workspace Settings — SiteView Missions" },
      {
        property: "og:description",
        content: "Organization profile, member roles and Flight Agent device token management.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Settings,
});

const inputClass =
  "w-full rounded-sm border border-border bg-input px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary";
const labelClass = "font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";
const buttonClass =
  "rounded-sm border border-primary/50 bg-primary/15 px-3 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.11em] text-primary transition-colors hover:bg-primary/25 disabled:opacity-50";
const ghostButtonClass =
  "rounded-sm border border-border bg-secondary px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-[0.11em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50";

const ROLES: AppRole[] = ["administrator", "drone_program_manager", "project_manager", "pilot", "viewer"];

function Settings() {
  const { user } = useSession();
  const { data: workspace } = useWorkspace(user?.id);
  const queryClient = useQueryClient();

  const org = useQuery(organizationQuery());
  const members = useQuery(membersQuery());
  const devices = useQuery(devicesQuery());
  const pilots = useQuery(pilotsQuery());
  const drones = useQuery(dronesQuery());

  const isAdmin = workspace?.roles.includes("administrator") ?? false;

  const [orgName, setOrgName] = useState<string | null>(null);
  const [sampleSeconds, setSampleSeconds] = useState<string | null>(null);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  const [deviceName, setDeviceName] = useState("");
  const [deviceIdentifier, setDeviceIdentifier] = useState("");
  const [devicePilot, setDevicePilot] = useState("");
  const [deviceDrone, setDeviceDrone] = useState("");

  const issue = useServerFn(issueDeviceToken);
  const setStatus = useServerFn(setDeviceStatus);
  const setRole = useServerFn(setMemberRole);

  const saveOrg = useMutation({
    mutationFn: async () => {
      if (!org.data) throw new Error("No organization loaded");
      const { error } = await supabase
        .from("organizations")
        .update({
          name: orgName ?? org.data.name,
          telemetry_sample_seconds: Math.max(1, Number(sampleSeconds ?? org.data.telemetry_sample_seconds)),
        })
        .eq("id", org.data.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Workspace updated");
      void queryClient.invalidateQueries({ queryKey: ["organization"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const registerDevice = useMutation({
    mutationFn: async () =>
      issue({
        data: {
          deviceName: deviceName.trim(),
          deviceIdentifier: deviceIdentifier.trim() || `pending-${Date.now()}`,
          pilotId: devicePilot || null,
          droneId: deviceDrone || null,
        },
      }),
    onSuccess: (result) => {
      setIssuedToken(result.token);
      setDeviceName("");
      setDeviceIdentifier("");
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rotate = useMutation({
    mutationFn: async (device: { id: string; device_name: string; device_identifier: string }) =>
      issue({
        data: {
          deviceId: device.id,
          deviceName: device.device_name,
          deviceIdentifier: device.device_identifier,
        },
      }),
    onSuccess: (result) => {
      setIssuedToken(result.token);
      toast.success("Token rotated — the old token no longer works");
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changeStatus = useMutation({
    mutationFn: async (input: { deviceId: string; status: "active" | "offline" | "revoked" | "update_required" }) =>
      setStatus({ data: input }),
    onSuccess: () => {
      toast.success("Device updated");
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changeRole = useMutation({
    mutationFn: async (input: { userId: string; role: AppRole }) => setRole({ data: input }),
    onSuccess: () => {
      toast.success("Role updated");
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Workspace settings"
      subtitle="Organization profile, member roles and the device tokens that authenticate the DJI Flight Agent."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Members" value={members.data?.length ?? 0} />
        <Metric
          label="Active devices"
          value={(devices.data ?? []).filter((d) => d.status === "active").length}
          tone="success"
        />
        <Metric
          label="Revoked devices"
          value={(devices.data ?? []).filter((d) => d.status === "revoked").length}
          tone="warning"
        />
        <Metric label="Telemetry rate" value={`${org.data?.telemetry_sample_seconds ?? 1}s`} hint="Sample interval" />
      </div>

      {issuedToken ? (
        <div className="mt-3 rounded-md border border-warning/50 bg-warning/10 p-4">
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.12em] text-warning">
            Copy this device token now — it is shown once
          </p>
          <p className="mt-2 break-all rounded-sm border border-border bg-input px-3 py-2 font-mono text-xs text-foreground">
            {issuedToken}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className={ghostButtonClass}
              onClick={() => {
                void navigator.clipboard.writeText(issuedToken);
                toast.success("Token copied");
              }}
            >
              Copy
            </button>
            <button type="button" className={ghostButtonClass} onClick={() => setIssuedToken(null)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <Panel title="Organization">
          {org.isPending ? (
            <LoadingPanel />
          ) : (
            <div className="space-y-3">
              <div>
                <label className={labelClass} htmlFor="org-name">
                  Workspace name
                </label>
                <input
                  id="org-name"
                  className={inputClass}
                  value={orgName ?? org.data?.name ?? ""}
                  onChange={(event) => setOrgName(event.target.value)}
                  disabled={!isAdmin}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="org-sample">
                  Telemetry sample interval (seconds)
                </label>
                <input
                  id="org-sample"
                  type="number"
                  min={1}
                  max={30}
                  className={inputClass}
                  value={sampleSeconds ?? String(org.data?.telemetry_sample_seconds ?? 1)}
                  onChange={(event) => setSampleSeconds(event.target.value)}
                  disabled={!isAdmin}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Controls how often the Flight Agent and the simulator persist telemetry samples.
                </p>
              </div>
              <button
                type="button"
                className={buttonClass}
                disabled={!isAdmin || saveOrg.isPending}
                onClick={() => saveOrg.mutate()}
              >
                {saveOrg.isPending ? "Saving…" : "Save workspace"}
              </button>
              {!isAdmin ? (
                <p className="text-xs text-muted-foreground">Administrator role required to edit the workspace.</p>
              ) : null}
            </div>
          )}
        </Panel>

        <Panel title="Register Flight Agent device">
          <div className="space-y-3">
            <div>
              <label className={labelClass} htmlFor="device-name">
                Device name
              </label>
              <input
                id="device-name"
                className={inputClass}
                placeholder="Field tablet — crew 2"
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="device-id">
                Hardware identifier (optional)
              </label>
              <input
                id="device-id"
                className={inputClass}
                placeholder="Android serial / IMEI"
                value={deviceIdentifier}
                onChange={(event) => setDeviceIdentifier(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="device-pilot">
                  Default pilot
                </label>
                <select
                  id="device-pilot"
                  className={inputClass}
                  value={devicePilot}
                  onChange={(event) => setDevicePilot(event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {(pilots.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="device-drone">
                  Default aircraft
                </label>
                <select
                  id="device-drone"
                  className={inputClass}
                  value={deviceDrone}
                  onChange={(event) => setDeviceDrone(event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {(drones.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.manufacturer} {d.model}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              className={buttonClass}
              disabled={deviceName.trim().length < 2 || registerDevice.isPending}
              onClick={() => registerDevice.mutate()}
            >
              {registerDevice.isPending ? "Issuing…" : "Issue device token"}
            </button>
            <p className="text-xs text-muted-foreground">
              The agent sends this token as <span className="font-mono">Authorization: Bearer …</span> to{" "}
              <span className="font-mono">/api/public/agent/register</span>. Only a hash is stored here.
            </p>
          </div>
        </Panel>
      </div>

      <Panel title="Flight Agent devices" className="mt-3" dense>
        {devices.isPending ? (
          <LoadingPanel />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-display text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-3 py-2">Device</th>
                <th className="hidden px-3 py-2 md:table-cell">Token</th>
                <th className="hidden px-3 py-2 lg:table-cell">Assignment</th>
                <th className="hidden px-3 py-2 lg:table-cell">Last seen</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(devices.data ?? []).map((device) => (
                <tr key={device.id} className="hover:bg-secondary/50">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground">{device.device_name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{device.device_identifier}</p>
                  </td>
                  <td className="hidden px-3 py-2.5 font-mono text-xs text-muted-foreground md:table-cell">
                    {device.token_preview ?? "— no token —"}
                  </td>
                  <td className="hidden px-3 py-2.5 text-xs text-muted-foreground lg:table-cell">
                    {(device as { pilots?: { full_name: string } | null }).pilots?.full_name ?? "No pilot"}
                    <span className="block">
                      {(device as { drones?: { model: string } | null }).drones?.model ?? "No aircraft"}
                    </span>
                  </td>
                  <td className="hidden px-3 py-2.5 font-mono text-xs text-muted-foreground lg:table-cell">
                    {device.last_seen ? formatDateTime(device.last_seen) : "Never"}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusChip label={DEVICE_STATUS_LABELS[device.status]} tone={toneForDevice(device.status)} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        className={ghostButtonClass}
                        disabled={rotate.isPending}
                        onClick={() =>
                          rotate.mutate({
                            id: device.id,
                            device_name: device.device_name,
                            device_identifier: device.device_identifier,
                          })
                        }
                      >
                        Rotate token
                      </button>
                      {device.status === "revoked" ? null : (
                        <button
                          type="button"
                          className={ghostButtonClass}
                          disabled={changeStatus.isPending}
                          onClick={() => changeStatus.mutate({ deviceId: device.id, status: "revoked" })}
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Members & roles" className="mt-3" dense>
        {members.isPending ? (
          <LoadingPanel />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-display text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-3 py-2">Member</th>
                <th className="hidden px-3 py-2 md:table-cell">Email</th>
                <th className="px-3 py-2">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(members.data ?? []).map((member) => (
                <tr key={member.id} className="hover:bg-secondary/50">
                  <td className="px-3 py-2.5 font-medium text-foreground">
                    {member.full_name ?? "Operator"}
                    {member.id === user?.id ? (
                      <span className="ml-2 font-mono text-[10px] uppercase text-muted-foreground">you</span>
                    ) : null}
                  </td>
                  <td className="hidden px-3 py-2.5 font-mono text-xs text-muted-foreground md:table-cell">
                    {member.email ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {isAdmin ? (
                      <select
                        className={inputClass}
                        value={member.roles[0] ?? "viewer"}
                        onChange={(event) =>
                          changeRole.mutate({ userId: member.id, role: event.target.value as AppRole })
                        }
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <StatusChip label={ROLE_LABELS[member.roles[0] ?? "viewer"]} dot={false} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </AppShell>
  );
}
