import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, LoadingPanel, Metric, Panel } from "@/components/app-shell";
import { StatusChip, DemoBadge, toneForDroneStatus, toneForFlightStatus, toneForResult } from "@/components/status-chip";
import {
  dronesQuery,
  flightsQuery,
  projectsQuery,
  schedulesQuery,
  assignmentsQuery,
} from "@/lib/queries";
import {
  DRONE_STATUS_LABELS,
  FLIGHT_RESULT_LABELS,
  FLIGHT_STATUS_LABELS,
  FREQUENCY_LABELS,
  formatDateTime,
  formatDuration,
} from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Mission Dashboard — SiteView Missions" },
      {
        name: "description",
        content:
          "Operations overview for construction drone programs: active projects, upcoming scheduled flights, fleet readiness and recent flight results.",
      },
      { property: "og:title", content: "Mission Dashboard — SiteView Missions" },
      {
        property: "og:description",
        content: "Active projects, upcoming missions, fleet readiness and recent flight results in one panel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const projects = useQuery(projectsQuery());
  const flights = useQuery(flightsQuery({ limit: 8 }));
  const drones = useQuery(dronesQuery());
  const schedules = useQuery(schedulesQuery());
  const assignments = useQuery(assignmentsQuery());

  const activeProjects = (projects.data ?? []).filter((p) => p.status === "active");
  const availableDrones = (drones.data ?? []).filter((d) => d.status === "available");
  const upcoming = (assignments.data ?? []).filter(
    (a) => a.status === "scheduled" || a.status === "assigned" || a.status === "preflight",
  );
  const completed = (flights.data ?? []).filter((f) => f.status === "completed");

  return (
    <AppShell
      title="Mission Dashboard"
      subtitle="Program-wide status across projects, missions, fleet and flight history."
      actions={<DemoBadge />}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active projects" value={activeProjects.length} hint={`${projects.data?.length ?? 0} total`} />
        <Metric
          label="Upcoming flights"
          value={upcoming.length}
          hint="Scheduled or assigned"
          tone="info"
        />
        <Metric
          label="Aircraft available"
          value={`${availableDrones.length}/${drones.data?.length ?? 0}`}
          hint="Fleet readiness"
          tone={availableDrones.length > 0 ? "success" : "warning"}
        />
        <Metric
          label="Flights logged"
          value={completed.length}
          hint="Recent completed missions"
        />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Recent flights"
          dense
          action={
            <Link to="/flights" className="font-display text-[10px] uppercase tracking-[0.12em] text-primary">
              All flights
            </Link>
          }
        >
          {flights.isPending ? (
            <LoadingPanel />
          ) : (flights.data ?? []).length === 0 ? (
            <EmptyState title="No flights yet" body="Flights appear here once a mission is executed or simulated." />
          ) : (
            <div className="divide-y divide-border">
              {(flights.data ?? []).map((flight: any) => (
                <Link
                  key={flight.id}
                  to="/flights/$flightId"
                  params={{ flightId: flight.id }}
                  className="flex flex-wrap items-center gap-3 px-3 py-2.5 transition-colors hover:bg-secondary/60"
                >
                  <div className="min-w-52 flex-1">
                    <p className="text-sm font-medium text-foreground">{flight.missions?.name ?? "Mission"}</p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      {flight.projects?.name} • {formatDateTime(flight.started_at ?? flight.scheduled_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {flight.is_simulated ? <StatusChip label="Sim" tone="warning" dot={false} /> : null}
                    <StatusChip
                      label={FLIGHT_STATUS_LABELS[flight.status as keyof typeof FLIGHT_STATUS_LABELS]}
                      tone={toneForFlightStatus(flight.status)}
                    />
                    {flight.result ? (
                      <StatusChip
                        label={FLIGHT_RESULT_LABELS[flight.result as keyof typeof FLIGHT_RESULT_LABELS]}
                        tone={toneForResult(flight.result)}
                        dot={false}
                      />
                    ) : null}
                  </div>
                  <div className="w-28 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {formatDuration(flight.duration_seconds)} • {flight.photos_captured}p
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <div className="space-y-3">
          <Panel title="Upcoming schedule" dense>
            {schedules.isPending ? (
              <LoadingPanel />
            ) : (schedules.data ?? []).length === 0 ? (
              <p className="px-3 py-6 text-sm text-muted-foreground">No repeat schedules configured.</p>
            ) : (
              <div className="divide-y divide-border">
                {(schedules.data ?? []).map((s: any) => (
                  <div key={s.id} className="px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{s.missions?.name}</p>
                      <StatusChip
                        label={FREQUENCY_LABELS[s.frequency as keyof typeof FREQUENCY_LABELS]}
                        tone={s.is_active ? "primary" : "neutral"}
                        dot={false}
                      />
                    </div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      {s.projects?.name} • next {formatDateTime(s.next_occurrence)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Fleet" dense>
            {drones.isPending ? (
              <LoadingPanel />
            ) : (
              <div className="divide-y divide-border">
                {(drones.data ?? []).map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {d.manufacturer} {d.model}
                      </p>
                      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                        {d.nickname ?? d.serial_number ?? "—"} • {Number(d.flight_hours).toFixed(1)} h
                      </p>
                    </div>
                    <StatusChip label={DRONE_STATUS_LABELS[d.status]} tone={toneForDroneStatus(d.status)} />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Panel
        title="Projects"
        className="mt-3"
        dense
        action={
          <Link to="/projects" className="font-display text-[10px] uppercase tracking-[0.12em] text-primary">
            All projects
          </Link>
        }
      >
        {projects.isPending ? (
          <LoadingPanel />
        ) : (
          <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {(projects.data ?? []).map((p) => (
              <Link
                key={p.id}
                to="/projects/$projectId"
                params={{ projectId: p.id }}
                className="rounded-md border border-border bg-panel/50 p-3 transition-colors hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
                      {p.name}
                    </p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      {p.project_number ?? "—"} • {p.client ?? "Internal"}
                    </p>
                  </div>
                  <StatusChip label={p.status} tone={p.status === "active" ? "success" : "neutral"} dot={false} />
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${p.progress_percent}%` }} />
                </div>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">{p.progress_percent}% complete</p>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
