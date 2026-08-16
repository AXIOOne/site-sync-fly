import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, LoadingPanel, Metric, Panel, SectionLabel } from "@/components/app-shell";
import { StatusChip, toneForFlightStatus, toneForReadiness } from "@/components/status-chip";
import { SiteMap } from "@/components/map/site-map";
import {
  boundariesQuery,
  flightsQuery,
  mediaQuery,
  missionsQuery,
  projectQuery,
  schedulesQuery,
  waypointsQuery,
} from "@/lib/queries";
import {
  FLIGHT_STATUS_LABELS,
  FREQUENCY_LABELS,
  MISSION_TYPE_LABELS,
  formatDate,
  formatDateTime,
  formatDuration,
} from "@/lib/domain";
import { ringFromGeoJson } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Project — Aerial Site Ops" },
      {
        name: "description",
        content:
          "Site overview with boundaries, repeatable missions, flight history, schedules and captured progress imagery.",
      },
      { property: "og:title", content: "Project — Aerial Site Ops" },
      {
        property: "og:description",
        content: "Site boundaries, repeatable missions, flight history and progress imagery for one project.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const project = useQuery(projectQuery(projectId));
  const boundaries = useQuery(boundariesQuery(projectId));
  const missions = useQuery(missionsQuery(projectId));
  const flights = useQuery(flightsQuery({ projectId, limit: 12 }));
  const schedules = useQuery(schedulesQuery(projectId));
  const media = useQuery(mediaQuery({ projectId }));

  const primaryMissionId = missions.data?.[0]?.id;
  const waypoints = useQuery({ ...waypointsQuery(primaryMissionId ?? ""), enabled: Boolean(primaryMissionId) });

  if (project.isPending) {
    return (
      <AppShell title="Project">
        <LoadingPanel />
      </AppShell>
    );
  }

  const p = project.data!;
  const rings = (boundaries.data ?? [])
    .map((b) => ({ ring: ringFromGeoJson(b.geojson), label: b.label, kind: b.kind }))
    .filter((b): b is { ring: [number, number][]; label: string; kind: string } => Boolean(b.ring));

  const completed = (flights.data ?? []).filter((f: any) => f.status === "completed");

  return (
    <AppShell
      title={p.name}
      subtitle={`${p.project_number ?? "—"} • ${p.client ?? "Internal"} • ${p.address ?? "Location not set"}`}
      actions={
        <>
          <StatusChip label={p.status} tone={p.status === "active" ? "success" : "neutral"} dot={false} />
          <Link
            to="/media"
            search={{ projectId }}
            className="rounded-sm border border-border px-2.5 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.11em] text-foreground hover:bg-secondary"
          >
            Progress timeline
          </Link>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Progress" value={`${p.progress_percent}%`} hint={`Target ${formatDate(p.estimated_completion)}`} />
        <Metric label="Missions" value={missions.data?.length ?? 0} hint="Defined for this site" />
        <Metric label="Flights" value={completed.length} hint="Completed" tone="success" />
        <Metric label="Media captured" value={media.data?.length ?? 0} hint="Photos & derived products" tone="info" />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.35fr_1fr]">
        <Panel title="Site map" dense>
          <SiteMap
            className="h-[420px] w-full"
            center={{ latitude: p.latitude ?? 39.829, longitude: p.longitude ?? -104.933 }}
            zoom={15.6}
            boundaries={rings}
            waypoints={(waypoints.data ?? []).map((w: any) => ({
              key: w.id,
              sequence: w.sequence,
              latitude: w.latitude,
              longitude: w.longitude,
            }))}
          />
          <div className="flex flex-wrap gap-3 border-t border-border px-3 py-2">
            {rings.map((r) => (
              <span key={r.label} className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                {r.label} · {r.kind}
              </span>
            ))}
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel title="Project team">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="Project manager" value={p.project_manager} />
              <Detail label="Superintendent" value={p.superintendent} />
              <Detail label="Start" value={formatDate(p.start_date)} />
              <Detail label="Target completion" value={formatDate(p.estimated_completion)} />
              <Detail label="Procore project" value={p.procore_project_id} />
              <Detail
                label="Coordinates"
                value={p.latitude != null ? `${p.latitude.toFixed(5)}, ${p.longitude?.toFixed(5)}` : null}
              />
            </dl>
            {p.description ? <p className="mt-3 text-sm text-muted-foreground">{p.description}</p> : null}
          </Panel>

          <Panel title="Repeat schedules" dense>
            {(schedules.data ?? []).length === 0 ? (
              <p className="px-3 py-5 text-sm text-muted-foreground">No repeat schedule configured.</p>
            ) : (
              <div className="divide-y divide-border">
                {(schedules.data ?? []).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.missions?.name}</p>
                      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                        next {formatDateTime(s.next_occurrence)}
                      </p>
                    </div>
                    <StatusChip
                      label={FREQUENCY_LABELS[s.frequency as keyof typeof FREQUENCY_LABELS]}
                      tone={s.is_active ? "primary" : "neutral"}
                      dot={false}
                    />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Panel title="Missions" className="mt-3" dense>
        {missions.isPending ? (
          <LoadingPanel />
        ) : (missions.data ?? []).length === 0 ? (
          <EmptyState title="No missions" body="Create a mission to define waypoints, camera behaviour and repeats." />
        ) : (
          <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {(missions.data ?? []).map((m) => (
              <Link
                key={m.id}
                to="/missions/$missionId"
                params={{ missionId: m.id }}
                className="rounded-md border border-border bg-panel/50 p-3 transition-colors hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
                      {m.name}
                    </p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      {MISSION_TYPE_LABELS[m.mission_type]} • v{m.current_version}
                    </p>
                  </div>
                  <StatusChip label={m.readiness_state} tone={toneForReadiness(m.readiness_state)} dot={false} />
                </div>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  {Number(m.altitude_ft)} ft • {Number(m.speed_mph)} mph • gimbal {Number(m.gimbal_pitch)}°
                </p>
                {m.is_repeatable ? (
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-info">
                    Repeats {FREQUENCY_LABELS[m.repeat_frequency]}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Flight history" className="mt-3" dense>
        {(flights.data ?? []).length === 0 ? (
          <p className="px-3 py-5 text-sm text-muted-foreground">No flights recorded for this project.</p>
        ) : (
          <div className="divide-y divide-border">
            {(flights.data ?? []).map((f: any) => (
              <Link
                key={f.id}
                to="/flights/$flightId"
                params={{ flightId: f.id }}
                className="flex flex-wrap items-center gap-3 px-3 py-2.5 hover:bg-secondary/60"
              >
                <div className="min-w-48 flex-1">
                  <p className="text-sm font-medium text-foreground">{f.missions?.name}</p>
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    {formatDateTime(f.started_at ?? f.scheduled_at)} • {f.pilots?.full_name ?? "Unassigned"}
                  </p>
                </div>
                {f.is_simulated ? <StatusChip label="Sim" tone="warning" dot={false} /> : null}
                <StatusChip
                  label={FLIGHT_STATUS_LABELS[f.status as keyof typeof FLIGHT_STATUS_LABELS]}
                  tone={toneForFlightStatus(f.status)}
                />
                <span className="w-32 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {formatDuration(f.duration_seconds)} • {f.photos_captured} photos
                </span>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <p className="mt-0.5 text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}
