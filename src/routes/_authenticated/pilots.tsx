import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, EmptyState, LoadingPanel, Metric, Panel } from "@/components/app-shell";
import { StatusChip } from "@/components/status-chip";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useWorkspace } from "@/hooks/useSession";
import { dronesQuery, flightsQuery, pilotsQuery } from "@/lib/queries";
import { formatDate } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/pilots")({
  head: () => ({
    meta: [
      { title: "Pilots & Part 107 — Aerial Site Ops" },
      {
        name: "description",
        content:
          "Manage remote pilot profiles, FAA Part 107 certificate numbers and expirations, aircraft assignments and logged flight history.",
      },
      { property: "og:title", content: "Pilots & Part 107 — Aerial Site Ops" },
      {
        property: "og:description",
        content: "Remote pilot profiles, Part 107 certificate tracking and logged flight history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pilots,
});

const inputClass =
  "w-full rounded-sm border border-border bg-input px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary";
const labelClass = "font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";
const buttonClass =
  "rounded-sm border border-primary/50 bg-primary/15 px-3 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.11em] text-primary transition-colors hover:bg-primary/25 disabled:opacity-50";

interface PilotForm {
  id: string | null;
  full_name: string;
  email: string;
  phone: string;
  faa_certificate_number: string;
  certificate_expiration: string;
  assigned_drone_id: string;
}

const EMPTY: PilotForm = {
  id: null,
  full_name: "",
  email: "",
  phone: "",
  faa_certificate_number: "",
  certificate_expiration: "",
  assigned_drone_id: "",
};

function certificateTone(expiration: string | null): { label: string; tone: "success" | "warning" | "danger" | "neutral" } {
  if (!expiration) return { label: "No certificate", tone: "neutral" };
  const days = Math.round((new Date(expiration).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: "Expired", tone: "danger" };
  if (days < 60) return { label: `${days}d left`, tone: "warning" };
  return { label: "Current", tone: "success" };
}

function Pilots() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: workspace } = useWorkspace(user?.id);
  const pilots = useQuery(pilotsQuery());
  const drones = useQuery(dronesQuery());
  const flights = useQuery(flightsQuery({ limit: 400 }));

  const [form, setForm] = useState<PilotForm>(EMPTY);
  const [open, setOpen] = useState(false);

  const flightsByPilot = useMemo(() => {
    const map = new Map<string, { count: number; last: string | null }>();
    for (const flight of flights.data ?? []) {
      if (!flight.pilot_id) continue;
      const entry = map.get(flight.pilot_id) ?? { count: 0, last: null };
      entry.count += 1;
      const stamp = flight.started_at ?? flight.scheduled_at;
      if (stamp && (!entry.last || stamp > entry.last)) entry.last = stamp;
      map.set(flight.pilot_id, entry);
    }
    return map;
  }, [flights.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error("Workspace not ready");
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        faa_certificate_number: form.faa_certificate_number.trim() || null,
        certificate_expiration: form.certificate_expiration || null,
        assigned_drone_id: form.assigned_drone_id || null,
      };
      if (form.id) {
        const { error } = await supabase.from("pilots").update(payload).eq("id", form.id);
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await supabase
        .from("pilots")
        .insert({ ...payload, organization_id: workspace.organization.id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(form.id ? "Pilot updated" : "Pilot added");
      setForm(EMPTY);
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["pilots"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const expiringSoon = (pilots.data ?? []).filter((p) => {
    const tone = certificateTone(p.certificate_expiration).tone;
    return tone === "warning" || tone === "danger";
  }).length;

  return (
    <AppShell
      title="Pilots"
      subtitle="Remote pilot in command records, Part 107 currency and aircraft pairing for Flight Agent dispatch."
      actions={
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            setForm(EMPTY);
            setOpen((value) => !value);
          }}
        >
          {open ? "Close" : "Add pilot"}
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Pilots" value={pilots.data?.length ?? 0} />
        <Metric
          label="Certificates due"
          value={expiringSoon}
          tone={expiringSoon > 0 ? "warning" : "success"}
          hint="Within 60 days"
        />
        <Metric
          label="Logged flights"
          value={(pilots.data ?? []).reduce((sum, p) => sum + p.flight_count, 0)}
        />
        <Metric
          label="Flight hours"
          value={(pilots.data ?? []).reduce((sum, p) => sum + Number(p.flight_hours), 0).toFixed(1)}
          tone="info"
        />
      </div>

      {open ? (
        <Panel title={form.id ? "Edit pilot" : "Add pilot"} className="mt-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor="p-name">
                Full name
              </label>
              <input
                id="p-name"
                className={inputClass}
                value={form.full_name}
                onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="p-email">
                Email
              </label>
              <input
                id="p-email"
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="p-phone">
                Phone
              </label>
              <input
                id="p-phone"
                className={inputClass}
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="p-cert">
                FAA Part 107 certificate
              </label>
              <input
                id="p-cert"
                className={inputClass}
                value={form.faa_certificate_number}
                onChange={(event) => setForm({ ...form, faa_certificate_number: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="p-exp">
                Certificate expiration
              </label>
              <input
                id="p-exp"
                type="date"
                className={inputClass}
                value={form.certificate_expiration}
                onChange={(event) => setForm({ ...form, certificate_expiration: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="p-drone">
                Assigned aircraft
              </label>
              <select
                id="p-drone"
                className={inputClass}
                value={form.assigned_drone_id}
                onChange={(event) => setForm({ ...form, assigned_drone_id: event.target.value })}
              >
                <option value="">Unassigned</option>
                {(drones.data ?? []).map((drone) => (
                  <option key={drone.id} value={drone.id}>
                    {drone.manufacturer} {drone.model}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            className={`${buttonClass} mt-3`}
            disabled={form.full_name.trim().length < 3 || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : form.id ? "Save pilot" : "Add pilot"}
          </button>
        </Panel>
      ) : null}

      <Panel title="Crew" className="mt-3" dense>
        {pilots.isPending ? (
          <LoadingPanel />
        ) : (pilots.data ?? []).length === 0 ? (
          <EmptyState title="No pilots" body="Add the remote pilots who will fly missions from the Flight Agent." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-display text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-3 py-2">Pilot</th>
                <th className="hidden px-3 py-2 md:table-cell">Part 107</th>
                <th className="px-3 py-2">Currency</th>
                <th className="hidden px-3 py-2 lg:table-cell">Aircraft</th>
                <th className="px-3 py-2 text-right">Flights</th>
                <th className="hidden px-3 py-2 lg:table-cell">Last flight</th>
                <th className="px-3 py-2 text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(pilots.data ?? []).map((pilot) => {
                const cert = certificateTone(pilot.certificate_expiration);
                const history = flightsByPilot.get(pilot.id);
                const drone = (drones.data ?? []).find((d) => d.id === pilot.assigned_drone_id);
                return (
                  <tr key={pilot.id} className="hover:bg-secondary/50">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-foreground">{pilot.full_name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{pilot.email ?? "—"}</p>
                    </td>
                    <td className="hidden px-3 py-2.5 font-mono text-xs text-muted-foreground md:table-cell">
                      {pilot.faa_certificate_number ?? "—"}
                      <span className="block">{formatDate(pilot.certificate_expiration)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusChip label={cert.label} tone={cert.tone} />
                    </td>
                    <td className="hidden px-3 py-2.5 text-muted-foreground lg:table-cell">
                      {drone ? `${drone.manufacturer} ${drone.model}` : "Unassigned"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-foreground">
                      {history?.count ?? pilot.flight_count}
                    </td>
                    <td className="hidden px-3 py-2.5 font-mono text-xs text-muted-foreground lg:table-cell">
                      {formatDate(history?.last ?? null)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        className="font-display text-[10px] font-semibold uppercase tracking-[0.11em] text-primary hover:underline"
                        onClick={() => {
                          setForm({
                            id: pilot.id,
                            full_name: pilot.full_name,
                            email: pilot.email ?? "",
                            phone: pilot.phone ?? "",
                            faa_certificate_number: pilot.faa_certificate_number ?? "",
                            certificate_expiration: pilot.certificate_expiration ?? "",
                            assigned_drone_id: pilot.assigned_drone_id ?? "",
                          });
                          setOpen(true);
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </AppShell>
  );
}
