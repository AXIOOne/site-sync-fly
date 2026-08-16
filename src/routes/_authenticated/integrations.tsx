import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell, LoadingPanel, Panel, SectionLabel } from "@/components/app-shell";
import { StatusChip, toneForIntegration } from "@/components/status-chip";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useWorkspace } from "@/hooks/useSession";
import { integrationsQuery, projectsQuery } from "@/lib/queries";
import { getFlightWeather } from "@/lib/weather.functions";
import { INTEGRATION_STATUS_LABELS, formatDateTime } from "@/lib/domain";


export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations & Flight Agent — SiteView Missions" },
      {
        name: "description",
        content:
          "DJI Flight Agent architecture, mission package format and the integration surface for Procore, weather, airspace and photogrammetry tools.",
      },
      { property: "og:title", content: "Integrations & Flight Agent — SiteView Missions" },
      {
        property: "og:description",
        content: "How the future DJI Flight Agent connects, plus the platform's integration surface.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Integrations,
});

const AGENT_ENDPOINTS = [
  {
    method: "POST",
    path: "/api/public/agent/register",
    body: '{ "device_identifier", "device_name", "enrollment_code" }',
    note: "Exchanges an enrollment code for a device token.",
  },
  {
    method: "GET",
    path: "/api/public/agent/missions",
    body: "Bearer device token",
    note: "Returns dispatched assignments with the full mission package and WPML.",
  },
  {
    method: "POST",
    path: "/api/public/agent/flights",
    body: '{ "assignment_id", "status", "started_at" }',
    note: "Opens or updates a flight record from the aircraft side.",
  },
  {
    method: "POST",
    path: "/api/public/agent/telemetry",
    body: '{ "flight_id", "samples": [...] }',
    note: "Batched telemetry ingestion at the organization sample rate.",
  },
  {
    method: "POST",
    path: "/api/public/agent/events",
    body: '{ "flight_id", "events": [...] }',
    note: "Mission event stream (takeoff, waypoint reached, RTH, errors).",
  },
  {
    method: "POST",
    path: "/api/public/agent/media",
    body: '{ "flight_id", "items": [...] }',
    note: "Registers captured photos with geotags and gimbal metadata.",
  },
];

const PROVIDER_FIELDS: Record<string, { key: string; label: string; placeholder: string }[]> = {
  procore: [
    { key: "company_id", label: "Procore company ID", placeholder: "598134325" },
    { key: "project_id", label: "Procore project ID", placeholder: "1029384" },
    { key: "folder", label: "Documents folder", placeholder: "Drone / Weekly Progress" },
  ],
  weather: [{ key: "provider_name", label: "Weather source", placeholder: "Open-Meteo" }],
  airspace: [{ key: "api_base", label: "LAANC provider base URL", placeholder: "https://api.example.com" }],
};

function WeatherPanel() {
  const projects = useQuery(projectsQuery());
  const [projectId, setProjectId] = useState("");
  const fetchWeather = useServerFn(getFlightWeather);
  const site = (projects.data ?? []).find((p) => p.id === projectId) ?? (projects.data ?? [])[0];

  const weather = useQuery({
    queryKey: ["flight-weather", site?.id],
    enabled: Boolean(site?.latitude && site?.longitude),
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      fetchWeather({ data: { latitude: Number(site!.latitude), longitude: Number(site!.longitude) } }),
  });

  const verdictTone =
    weather.data?.verdict === "GO" ? "success" : weather.data?.verdict === "CAUTION" ? "warning" : "danger";

  return (
    <Panel title="Live flight weather" className="mt-3">
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          <SectionLabel>Site</SectionLabel>
          <select
            value={site?.id ?? ""}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded-sm border border-border bg-input px-2 py-2 text-sm text-foreground"
          >
            {(projects.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Open-Meteo conditions at the takeoff point, evaluated against conservative Part 107 limits. No API key
            required.
          </p>
        </div>
        {weather.isPending ? (
          <LoadingPanel label="Reading conditions" />
        ) : weather.isError || !weather.data ? (
          <p className="text-sm text-muted-foreground">Weather service unavailable for this site.</p>
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusChip label={weather.data.verdict} tone={verdictTone} />
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                observed {formatDateTime(weather.data.observedAt)}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {[
                { label: "Temp", value: `${weather.data.temperatureF}°F` },
                { label: "Wind", value: `${weather.data.windMph} mph` },
                { label: "Gusts", value: `${weather.data.gustMph} mph` },
                { label: "Precip", value: `${weather.data.precipitationChance}%` },
                {
                  label: "Visibility",
                  value: weather.data.visibilityMi != null ? `${weather.data.visibilityMi} mi` : "—",
                },
              ].map((m) => (
                <div key={m.label} className="rounded-md border border-border bg-panel/50 p-2.5">
                  <p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {m.label}
                  </p>
                  <p className="mt-0.5 font-display text-base font-bold text-foreground">{m.value}</p>
                </div>
              ))}
            </div>
            {weather.data.reasons.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs text-warning">
                {weather.data.reasons.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-success">All checked limits satisfied for a standard progress flight.</p>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

function IntegrationCard({
  integration,
  canEdit,
  onSaved,
}: {
  integration: { id: string; provider: string; status: string; config: unknown; connected_at: string | null };
  canEdit: boolean;
  onSaved: () => void;
}) {
  const config = (integration.config ?? {}) as Record<string, unknown>;
  const fields = PROVIDER_FIELDS[integration.provider] ?? [];
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, typeof config[f.key] === "string" ? (config[f.key] as string) : ""])),
  );

  const save = useMutation({
    mutationFn: async (connect: boolean) => {
      const { error } = await supabase
        .from("integrations")
        .update({
          config: { ...config, ...values } as never,
          status: connect ? "connected" : "not_connected",
          connected_at: connect ? new Date().toISOString() : null,
        })
        .eq("id", integration.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, connect) => {
      toast.success(connect ? `${integration.provider} connected` : `${integration.provider} disconnected`);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const connected = integration.status === "connected";

  return (
    <div className="rounded-md border border-border bg-panel/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
          {integration.provider}
        </p>
        <StatusChip
          label={INTEGRATION_STATUS_LABELS[integration.status as keyof typeof INTEGRATION_STATUS_LABELS]}
          tone={toneForIntegration(integration.status as never)}
          dot={false}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {typeof config["description"] === "string" ? (config["description"] as string) : "—"}
      </p>

      {fields.length > 0 ? (
        <div className="mt-3 space-y-2">
          {fields.map((f) => (
            <label key={f.key} className="block">
              <span className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {f.label}
              </span>
              <input
                value={values[f.key] ?? ""}
                placeholder={f.placeholder}
                disabled={!canEdit}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="mt-1 w-full rounded-sm border border-border bg-input px-2 py-1.5 text-sm text-foreground disabled:opacity-60"
              />
            </label>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={!canEdit || save.isPending}
              onClick={() => save.mutate(true)}
              className="flex-1 rounded-sm border border-primary/50 bg-primary/15 px-2 py-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.11em] text-primary hover:bg-primary/25 disabled:opacity-60"
            >
              {connected ? "Save & keep connected" : "Connect"}
            </button>
            {connected ? (
              <button
                type="button"
                disabled={!canEdit || save.isPending}
                onClick={() => save.mutate(false)}
                className="rounded-sm border border-border px-2 py-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.11em] text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                Disconnect
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {integration.connected_at ? `connected ${formatDateTime(integration.connected_at)}` : "not connected"}
      </p>
    </div>
  );
}

function Integrations() {
  const integrations = useQuery(integrationsQuery());
  const { user } = useSession();
  const { data: workspace } = useWorkspace(user?.id);
  const queryClient = useQueryClient();




  return (
    <AppShell
      title="Integrations & Flight Agent"
      subtitle="This platform plans, versions and records missions. Aircraft control happens in a separate DJI Flight Agent."
    >
      <Panel title="DJI Flight Agent architecture">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              The web platform never talks to an aircraft. It produces a versioned{" "}
              <span className="text-foreground">mission package</span> (JSON + DJI WPML) and exposes a token-authenticated
              API. A future Android app built on DJI Mobile SDK 5 pulls that package, flies it, and streams telemetry,
              events and media back.
            </p>
            <ul className="space-y-1.5 font-mono text-[11px] uppercase tracking-[0.08em]">
              <li>1 — Planner creates mission, immutable version snapshot</li>
              <li>2 — Schedule or dispatch creates an assignment</li>
              <li>3 — Agent authenticates with a device token</li>
              <li>4 — Agent downloads package + WPML for the assignment</li>
              <li>5 — Agent executes with DJI MSDK 5 and streams back</li>
              <li>6 — Platform stores flight, telemetry, events, media</li>
            </ul>
            <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
              The Flight Agent app does not exist yet. Anything labelled simulated in this platform is generated here and
              is never presented as live DJI aircraft data.
            </div>
          </div>
          <div className="rounded-md border border-border bg-panel/60 p-3">
            <SectionLabel>Agent API surface</SectionLabel>
            <div className="mt-2 divide-y divide-border">
              {AGENT_ENDPOINTS.map((e) => (
                <div key={e.path} className="py-2">
                  <p className="font-mono text-[11px] text-foreground">
                    <span className="text-primary">{e.method}</span> {e.path}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">{e.body}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{e.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <WeatherPanel />

      <Panel title="Connected services" className="mt-3" dense>
        {integrations.isPending ? (
          <LoadingPanel />
        ) : (
          <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {(integrations.data ?? []).map((i) => (
              <IntegrationCard
                key={i.id}
                integration={i}
                canEdit={Boolean(workspace?.canEdit)}
                onSaved={() => queryClient.invalidateQueries({ queryKey: ["integrations"] })}
              />
            ))}
          </div>
        )}
      </Panel>

    </AppShell>
  );
}
