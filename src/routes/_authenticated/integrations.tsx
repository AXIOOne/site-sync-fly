import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell, LoadingPanel, Panel, SectionLabel } from "@/components/app-shell";
import { StatusChip, toneForIntegration } from "@/components/status-chip";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useSession";
import { integrationsQuery, projectsQuery } from "@/lib/queries";
import { getFlightWeather } from "@/lib/weather.functions";
import { INTEGRATION_STATUS_LABELS, formatDateTime } from "@/lib/domain";


export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations & Flight Agent — Aerial Site Ops" },
      {
        name: "description",
        content:
          "DJI Flight Agent architecture, mission package format and the integration surface for Procore, weather, airspace and photogrammetry tools.",
      },
      { property: "og:title", content: "Integrations & Flight Agent — Aerial Site Ops" },
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

function Integrations() {
  const integrations = useQuery(integrationsQuery());

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

      <Panel title="Connected services" className="mt-3" dense>
        {integrations.isPending ? (
          <LoadingPanel />
        ) : (
          <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {(integrations.data ?? []).map((i) => {
              const config = (i.config ?? {}) as Record<string, unknown>;
              return (
                <div key={i.id} className="rounded-md border border-border bg-panel/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
                      {i.provider}
                    </p>
                    <StatusChip
                      label={INTEGRATION_STATUS_LABELS[i.status]}
                      tone={toneForIntegration(i.status)}
                      dot={false}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {typeof config["description"] === "string" ? (config["description"] as string) : "—"}
                  </p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {i.connected_at ? `connected ${formatDateTime(i.connected_at)}` : "not connected"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
