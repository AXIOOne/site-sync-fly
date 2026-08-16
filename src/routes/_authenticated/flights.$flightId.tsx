import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, LoadingPanel, Metric, Panel, SectionLabel } from "@/components/app-shell";
import { SimulationBanner, StatusChip, toneForFlightStatus, toneForResult } from "@/components/status-chip";
import { SiteMap } from "@/components/map/site-map";
import { flightEventsQuery, flightQuery, mediaQuery, telemetryQuery, waypointsQuery } from "@/lib/queries";
import {
  FLIGHT_RESULT_LABELS,
  FLIGHT_STATUS_LABELS,
  formatDateTime,
  formatDistanceMeters,
  formatDuration,
} from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/flights/$flightId")({
  head: () => ({
    meta: [
      { title: "Flight Record — SiteView Missions" },
      {
        name: "description",
        content:
          "Flight record with flown track, telemetry samples, mission event log and every capture tied to the plan version that was flown.",
      },
      { property: "og:title", content: "Flight Record — SiteView Missions" },
      {
        property: "og:description",
        content: "Flown track, telemetry, event log and captures for a single drone flight.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FlightDetail,
});

function FlightDetail() {
  const { flightId } = Route.useParams();
  const flight = useQuery(flightQuery(flightId));
  const events = useQuery(flightEventsQuery(flightId));
  const telemetry = useQuery(telemetryQuery(flightId));
  const media = useQuery(mediaQuery({ flightId }));
  const missionId = (flight.data as any)?.mission_id as string | undefined;
  const waypoints = useQuery({ ...waypointsQuery(missionId ?? ""), enabled: Boolean(missionId) });

  if (flight.isPending) {
    return (
      <AppShell title="Flight record">
        <LoadingPanel />
      </AppShell>
    );
  }

  const f = flight.data as any;
  const samples = (telemetry.data ?? []) as any[];
  const track = samples
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ latitude: s.latitude as number, longitude: s.longitude as number }));
  const maxBattery = f.battery_start ?? 100;

  return (
    <AppShell
      title={f.missions?.name ?? "Flight"}
      subtitle={`${f.projects?.name} • ${formatDateTime(f.started_at ?? f.scheduled_at)} • ${f.pilots?.full_name ?? "Unassigned"} • ${f.drones?.manufacturer ?? ""} ${f.drones?.model ?? ""}`}
      actions={
        <>
          <StatusChip label={FLIGHT_STATUS_LABELS[f.status as keyof typeof FLIGHT_STATUS_LABELS]} tone={toneForFlightStatus(f.status)} />
          {f.result ? (
            <StatusChip
              label={FLIGHT_RESULT_LABELS[f.result as keyof typeof FLIGHT_RESULT_LABELS]}
              tone={toneForResult(f.result)}
              dot={false}
            />
          ) : null}
          <Link
            to="/missions/$missionId"
            params={{ missionId: f.mission_id }}
            className="rounded-sm border border-border px-2.5 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.11em] text-foreground hover:bg-secondary"
          >
            Open mission
          </Link>
        </>
      }
    >
      {f.is_simulated ? <SimulationBanner /> : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Duration" value={formatDuration(f.duration_seconds)} />
        <Metric label="Distance" value={formatDistanceMeters(f.distance_m == null ? null : Number(f.distance_m))} />
        <Metric label="Max altitude" value={f.max_altitude_ft ? `${Number(f.max_altitude_ft)} ft` : "—"} />
        <Metric label="Captures" value={`${f.photos_captured} / ${f.videos_captured}`} hint="photos / videos" />
        <Metric
          label="Completion"
          value={`${Number(f.completion_percent)}%`}
          tone={Number(f.completion_percent) >= 100 ? "success" : "warning"}
          hint={`battery ${f.battery_start ?? "—"}% → ${f.battery_end ?? "—"}%`}
        />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Flown track vs plan" dense>
          <SiteMap
            className="h-[420px] w-full"
            center={{
              latitude: track[0]?.latitude ?? f.projects?.latitude ?? 39.829,
              longitude: track[0]?.longitude ?? f.projects?.longitude ?? -104.933,
            }}
            zoom={16}
            trail={track}
            fitToWaypoints
            waypoints={(waypoints.data ?? []).map((w: any) => ({
              key: w.id,
              sequence: w.sequence,
              latitude: w.latitude,
              longitude: w.longitude,
            }))}
          />
          <p className="border-t border-border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Dashed amber = planned route · solid cyan = recorded track ({samples.length} samples)
          </p>
        </Panel>

        <Panel title="Event log" dense>
          <div className="max-h-[420px] divide-y divide-border overflow-y-auto">
            {(events.data ?? []).length === 0 ? (
              <p className="px-3 py-6 text-sm text-muted-foreground">No events recorded.</p>
            ) : (
              (events.data ?? []).map((e: any) => (
                <div key={e.id} className="flex items-start gap-2 px-3 py-2">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                  <div className="flex-1">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
                      {e.event_type.replace(/_/g, " ")}
                      {e.waypoint_sequence != null ? ` · WP ${e.waypoint_sequence}` : ""}
                    </p>
                    {e.message ? <p className="text-xs text-muted-foreground">{e.message}</p> : null}
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(e.occurred_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Telemetry" className="mt-3">
        {samples.length === 0 ? (
          <EmptyState title="No telemetry" body="Telemetry is streamed by the Flight Agent or produced by a simulated flight." />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <Sparkline
              label="Altitude (ft)"
              values={samples.map((s) => Number(s.altitude_ft ?? 0))}
              suffix=" ft"
            />
            <Sparkline label="Speed (mph)" values={samples.map((s) => Number(s.speed_mph ?? 0))} suffix=" mph" />
            <Sparkline
              label="Battery (%)"
              values={samples.map((s) => Number(s.battery_percent ?? 0))}
              suffix="%"
              max={maxBattery}
            />
          </div>
        )}
      </Panel>

      <Panel title={`Captures (${media.data?.length ?? 0})`} className="mt-3" dense>
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 lg:grid-cols-6">
          {(media.data ?? []).map((m: any) => (
            <figure key={m.id} className="overflow-hidden rounded-md border border-border">
              <img
                src={m.thumbnail_url ?? ""}
                alt={`Capture at waypoint ${m.waypoint_sequence ?? "—"}`}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
              <figcaption className="px-2 py-1 font-mono text-[10px] text-muted-foreground">
                WP {m.waypoint_sequence ?? "—"}
              </figcaption>
            </figure>
          ))}
          {(media.data ?? []).length === 0 ? (
            <p className="col-span-full py-4 text-sm text-muted-foreground">No captures registered for this flight.</p>
          ) : null}
        </div>
      </Panel>
    </AppShell>
  );
}

function Sparkline({
  label,
  values,
  suffix = "",
  max,
}: {
  label: string;
  values: number[];
  suffix?: string;
  max?: number;
}) {
  const peak = max ?? Math.max(1, ...values);
  const points = values
    .map((v, i) => `${(i / Math.max(1, values.length - 1)) * 100},${100 - (v / peak) * 100}`)
    .join(" ");
  return (
    <div>
      <div className="flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        <span className="font-mono text-xs tabular-nums text-foreground">
          {values.length ? `${Math.round(values[values.length - 1]!)}${suffix}` : "—"}
        </span>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-1 h-24 w-full">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-primary"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p className="font-mono text-[10px] text-muted-foreground">
        peak {Math.round(Math.max(0, ...values))}
        {suffix}
      </p>
    </div>
  );
}
