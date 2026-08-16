import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, LoadingPanel, Metric, Panel } from "@/components/app-shell";
import { StatusChip, toneForDevice, toneForDroneStatus } from "@/components/status-chip";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useWorkspace } from "@/hooks/useSession";
import { devicesQuery, dronesQuery, pilotsQuery } from "@/lib/queries";
import { DEVICE_STATUS_LABELS, DRONE_STATUS_LABELS, formatDate, formatDateTime } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/fleet")({
  head: () => ({
    meta: [
      { title: "Fleet & Pilots — SiteView Missions" },
      {
        name: "description",
        content:
          "Aircraft readiness, flight hours, RTK capability, pilot certifications and registered Flight Agent devices.",
      },
      { property: "og:title", content: "Fleet & Pilots — SiteView Missions" },
      {
        property: "og:description",
        content: "Aircraft readiness, pilot certifications and registered Flight Agent devices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Fleet,
});

const inputClass =
  "w-full rounded-sm border border-border bg-input px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary";
const labelClass = "font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";
const buttonClass =
  "rounded-sm border border-primary/50 bg-primary/15 px-3 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.11em] text-primary transition-colors hover:bg-primary/25 disabled:opacity-50";

const EMPTY_AIRCRAFT = {
  manufacturer: "DJI",
  model: "",
  nickname: "",
  serial_number: "",
  registration_number: "",
  camera: "",
  battery_capacity_minutes: "35",
  has_rtk: false,
};

function Fleet() {
  const drones = useQuery(dronesQuery());
  const pilots = useQuery(pilotsQuery());
  const devices = useQuery(devicesQuery());
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: workspace } = useWorkspace(user?.id);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_AIRCRAFT);

  const totalHours = (drones.data ?? []).reduce((sum, d) => sum + Number(d.flight_hours), 0);

  const addAircraft = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error("Workspace not ready");
      const { error } = await supabase.from("drones").insert({
        organization_id: workspace.organization.id,
        manufacturer: form.manufacturer.trim() || "DJI",
        model: form.model.trim(),
        nickname: form.nickname.trim() || null,
        serial_number: form.serial_number.trim() || null,
        registration_number: form.registration_number.trim() || null,
        camera: form.camera.trim() || null,
        battery_capacity_minutes: form.battery_capacity_minutes ? Number(form.battery_capacity_minutes) : null,
        has_rtk: form.has_rtk,
        status: "available",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Aircraft added to the fleet");
      setForm(EMPTY_AIRCRAFT);
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["drones"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Fleet & Pilots"
      subtitle="Aircraft, crew and the devices that will run the DJI Flight Agent."
      actions={
        <button type="button" className={buttonClass} onClick={() => setOpen((value) => !value)}>
          {open ? "Close" : "Add aircraft"}
        </button>
      }
    >
      {open ? (
        <Panel title="Add aircraft" className="mb-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor="a-manufacturer">
                Manufacturer
              </label>
              <input
                id="a-manufacturer"
                className={inputClass}
                value={form.manufacturer}
                onChange={(event) => setForm({ ...form, manufacturer: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="a-model">
                Model
              </label>
              <input
                id="a-model"
                className={inputClass}
                placeholder="Mavic 3E"
                value={form.model}
                onChange={(event) => setForm({ ...form, model: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="a-nickname">
                Nickname
              </label>
              <input
                id="a-nickname"
                className={inputClass}
                value={form.nickname}
                onChange={(event) => setForm({ ...form, nickname: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="a-serial">
                Serial number
              </label>
              <input
                id="a-serial"
                className={inputClass}
                value={form.serial_number}
                onChange={(event) => setForm({ ...form, serial_number: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="a-reg">
                FAA registration
              </label>
              <input
                id="a-reg"
                className={inputClass}
                value={form.registration_number}
                onChange={(event) => setForm({ ...form, registration_number: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="a-camera">
                Camera
              </label>
              <input
                id="a-camera"
                className={inputClass}
                value={form.camera}
                onChange={(event) => setForm({ ...form, camera: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="a-battery">
                Battery endurance (minutes)
              </label>
              <input
                id="a-battery"
                type="number"
                min={5}
                max={120}
                className={inputClass}
                value={form.battery_capacity_minutes}
                onChange={(event) => setForm({ ...form, battery_capacity_minutes: event.target.value })}
              />
            </div>
            <label className="flex items-end gap-2 pb-1.5 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={form.has_rtk}
                onChange={(event) => setForm({ ...form, has_rtk: event.target.checked })}
              />
              RTK equipped
            </label>
          </div>
          <button
            type="button"
            className={`${buttonClass} mt-3`}
            disabled={form.model.trim().length < 2 || addAircraft.isPending}
            onClick={() => addAircraft.mutate()}
          >
            {addAircraft.isPending ? "Adding…" : "Add aircraft"}
          </button>
        </Panel>
      ) : null}


      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Aircraft" value={drones.data?.length ?? 0} />
        <Metric
          label="Available"
          value={(drones.data ?? []).filter((d) => d.status === "available").length}
          tone="success"
        />
        <Metric label="Airframe hours" value={totalHours.toFixed(1)} hint="Cumulative" />
        <Metric label="Pilots" value={pilots.data?.length ?? 0} hint="Part 107 crew" tone="info" />
      </div>

      <Panel title="Aircraft" className="mt-3" dense>
        {drones.isPending ? (
          <LoadingPanel />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-display text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-3 py-2">Aircraft</th>
                <th className="hidden px-3 py-2 md:table-cell">Serial / registration</th>
                <th className="hidden px-3 py-2 lg:table-cell">Camera</th>
                <th className="px-3 py-2">RTK</th>
                <th className="px-3 py-2 text-right">Hours</th>
                <th className="hidden px-3 py-2 lg:table-cell">Last flight</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(drones.data ?? []).map((d) => (
                <tr key={d.id} className="hover:bg-secondary/50">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground">
                      {d.manufacturer} {d.model}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">{d.nickname ?? "—"}</p>
                  </td>
                  <td className="hidden px-3 py-2.5 font-mono text-xs text-muted-foreground md:table-cell">
                    {d.serial_number ?? "—"}
                    <span className="block">{d.registration_number ?? "—"}</span>
                  </td>
                  <td className="hidden px-3 py-2.5 text-muted-foreground lg:table-cell">{d.camera ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <StatusChip label={d.has_rtk ? "RTK" : "No RTK"} tone={d.has_rtk ? "info" : "neutral"} dot={false} />
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                    {Number(d.flight_hours).toFixed(1)}
                  </td>
                  <td className="hidden px-3 py-2.5 font-mono text-xs text-muted-foreground lg:table-cell">
                    {formatDateTime(d.last_flight_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusChip label={DRONE_STATUS_LABELS[d.status]} tone={toneForDroneStatus(d.status)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <Panel title="Pilots" dense>
          <div className="divide-y divide-border">
            {(pilots.data ?? []).map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-40 flex-1">
                  <p className="text-sm font-medium text-foreground">{p.full_name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{p.email ?? p.phone ?? "—"}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs text-muted-foreground">{p.faa_certificate_number ?? "No cert"}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    exp {formatDate(p.certificate_expiration)}
                  </p>
                </div>
                <div className="w-24 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {p.flight_count} flights
                  <span className="block">{Number(p.flight_hours).toFixed(1)} h</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Flight Agent devices" dense>
          <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
            Devices are the Android tablets that will run the DJI Flight Agent. Registration and tokens work today; the
            agent app itself is a future component.
          </p>
          <div className="divide-y divide-border">
            {(devices.data ?? []).length === 0 ? (
              <p className="px-3 py-6 text-sm text-muted-foreground">No devices registered.</p>
            ) : (
              (devices.data ?? []).map((d: any) => (
                <div key={d.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <div className="min-w-40 flex-1">
                    <p className="text-sm font-medium text-foreground">{d.device_name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {d.device_identifier} • {d.app_version ?? "no agent build"}
                    </p>
                  </div>
                  <div className="text-right font-mono text-[11px] text-muted-foreground">
                    {d.pilots?.full_name ?? "Unassigned"}
                    <span className="block">{d.drones?.model ?? "No aircraft"}</span>
                  </div>
                  <div className="text-right font-mono text-[11px] text-muted-foreground">
                    token {d.token_preview ?? "—"}
                    <span className="block">seen {formatDateTime(d.last_seen)}</span>
                  </div>
                  <StatusChip
                    label={DEVICE_STATUS_LABELS[d.status as keyof typeof DEVICE_STATUS_LABELS]}
                    tone={toneForDevice(d.status)}
                  />
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
