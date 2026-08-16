import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell, LoadingPanel, Metric, Panel, SectionLabel } from "@/components/app-shell";
import { SimulationBanner, StatusChip } from "@/components/status-chip";
import { SiteMap } from "@/components/map/site-map";
import { dronesQuery, missionQuery, missionVersionsQuery, pilotsQuery, projectQuery, waypointsQuery } from "@/lib/queries";
import { PREFLIGHT_ITEMS, formatDistanceMeters, formatDuration } from "@/lib/domain";
import type { LatLng } from "@/lib/geo";
import type { DraftWaypoint } from "@/lib/mission-planning";
import { FlightSimulator, type SimulatorState } from "@/lib/services/flight-simulator";
import {
  FlightExecutionService,
  MediaIngestionService,
  SIMULATED_CAPTURE_IMAGES,
  TelemetryService,
} from "@/lib/services/flight-execution";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useWorkspace } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/simulate/$missionId")({
  head: () => ({
    meta: [
      { title: "Mission Control — SiteView Missions" },
      {
        name: "description",
        content:
          "Run a preflight checklist and execute a simulated mission with live-style telemetry, event stream and captured waypoint imagery.",
      },
      { property: "og:title", content: "Mission Control — SiteView Missions" },
      {
        property: "og:description",
        content: "Preflight checklist plus a simulated mission run with telemetry and event streaming.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MissionControl,
});

type Phase = "preflight" | "running" | "complete";

function MissionControl() {
  const { missionId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: workspace } = useWorkspace(user?.id);

  const mission = useQuery(missionQuery(missionId));
  const projectId = mission.data?.project_id;
  const project = useQuery({ ...projectQuery(projectId ?? ""), enabled: Boolean(projectId) });
  const stored = useQuery(waypointsQuery(missionId));
  const versions = useQuery(missionVersionsQuery(missionId));
  const drones = useQuery(dronesQuery());
  const pilots = useQuery(pilotsQuery());

  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [phase, setPhase] = useState<Phase>("preflight");
  const [speedMultiplier, setSpeedMultiplier] = useState(8);
  const [state, setState] = useState<SimulatorState | null>(null);
  const [trail, setTrail] = useState<LatLng[]>([]);
  const [log, setLog] = useState<{ type: string; message: string; at: string }[]>([]);
  const [flightId, setFlightId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const simRef = useRef<FlightSimulator | null>(null);
  const telemetryRef = useRef<TelemetryService | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flightIdRef = useRef<string | null>(null);
  const maxAltRef = useRef(0);

  const waypoints: DraftWaypoint[] = useMemo(
    () =>
      ((stored.data ?? []) as any[]).map((w) => ({
        key: w.id,
        sequence: w.sequence,
        latitude: w.latitude,
        longitude: w.longitude,
        altitude_ft: Number(w.altitude_ft),
        heading: w.heading == null ? null : Number(w.heading),
        gimbal_pitch: Number(w.gimbal_pitch ?? -45),
        speed_mph: w.speed_mph == null ? null : Number(w.speed_mph),
        label: w.label,
        actions: (w.waypoint_actions ?? []).map((a: any) => ({
          action_type: a.action_type,
          param_numeric: a.param_numeric == null ? null : Number(a.param_numeric),
        })),
      })),
    [stored.data],
  );

  const allChecked = PREFLIGHT_ITEMS.every((item) => checks[item.key]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function appendLog(type: string, message: string) {
    setLog((prev) => [{ type, message, at: new Date().toISOString() }, ...prev].slice(0, 200));
  }

  async function startSimulation() {
    const m = mission.data;
    const p = project.data;
    if (!m || !p || !workspace) return;
    if (waypoints.length < 2) {
      toast.error("This mission needs at least two waypoints");
      return;
    }
    setBusy(true);
    try {
      const drone = (drones.data ?? []).find((d) => d.id === m.drone_id) ?? (drones.data ?? [])[0];
      const pilot = (pilots.data ?? []).find((pl) => pl.id === m.pilot_id) ?? (pilots.data ?? [])[0];
      const latestVersion = (versions.data ?? [])[0] as any;

      const flight = await FlightExecutionService.createFlight({
        organizationId: workspace.organization.id,
        projectId: p.id,
        missionId: m.id,
        missionVersionId: latestVersion?.id ?? null,
        pilotId: pilot?.id ?? null,
        droneId: drone?.id ?? null,
        isSimulated: true,
        batteryStart: 100,
      });
      setFlightId(flight.id);
      flightIdRef.current = flight.id;

      await supabase.from("preflight_checklists").insert({
        organization_id: workspace.organization.id,
        flight_id: flight.id,
        items: PREFLIGHT_ITEMS.map((i) => ({ key: i.key, label: i.label, checked: true })),
        completed: true,
        completed_at: new Date().toISOString(),
        completed_by: user?.id ?? null,
        pilot_id: pilot?.id ?? null,
      });

      await FlightExecutionService.recordEvent({
        flightId: flight.id,
        organizationId: workspace.organization.id,
        eventType: "PREFLIGHT_COMPLETE",
        message: "Preflight checklist completed",
        isSimulated: true,
      });
      await FlightExecutionService.recordEvent({
        flightId: flight.id,
        organizationId: workspace.organization.id,
        eventType: "TAKEOFF",
        message: "Simulated takeoff",
        isSimulated: true,
      });
      await FlightExecutionService.start(flight.id, workspace.organization.id, true);
      appendLog("PREFLIGHT_COMPLETE", "Preflight checklist completed");
      appendLog("TAKEOFF", "Simulated takeoff");

      const home: LatLng = {
        latitude: m.takeoff_lat ?? waypoints[0]!.latitude,
        longitude: m.takeoff_lng ?? waypoints[0]!.longitude,
      };
      simRef.current = new FlightSimulator(waypoints, {
        speedMph: Number(m.speed_mph),
        batteryMinutes: drone?.battery_capacity_minutes ?? 35,
        home,
        photoAtWaypoint: true,
      });
      telemetryRef.current = new TelemetryService(
        workspace.organization.id,
        flight.id,
        workspace.organization.telemetry_sample_seconds,
        true,
      );
      maxAltRef.current = 0;
      setTrail([]);
      setPhase("running");

      timerRef.current = setInterval(() => void step(), 250);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start simulation");
    } finally {
      setBusy(false);
    }
  }

  async function step() {
    const sim = simRef.current;
    const m = mission.data;
    const p = project.data;
    if (!sim || !m || !p || !workspace || !flightIdRef.current) return;
    const next = sim.tick(0.25, speedMultiplier);
    setState(next);
    maxAltRef.current = Math.max(maxAltRef.current, next.altitudeFt);
    setTrail((prev) => [...prev, { latitude: next.latitude, longitude: next.longitude }].slice(-4000));

    void telemetryRef.current?.ingest({
      latitude: next.latitude,
      longitude: next.longitude,
      altitudeFt: next.altitudeFt,
      speedMph: next.speedMph,
      heading: next.heading,
      batteryPercent: next.batteryPercent,
      satelliteCount: next.satelliteCount,
      currentWaypoint: next.currentWaypoint,
      flightMode: next.flightMode,
      distanceFromHomeM: next.distanceFromHomeM,
      missionProgress: Number(next.missionProgress.toFixed(1)),
    });

    if (next.reachedWaypoint) {
      const wp = waypoints[next.reachedWaypoint - 1];
      appendLog("WAYPOINT_REACHED", `Waypoint ${next.reachedWaypoint} reached`);
      void FlightExecutionService.recordEvent({
        flightId: flightIdRef.current,
        organizationId: workspace.organization.id,
        eventType: "WAYPOINT_REACHED",
        message: `Waypoint ${next.reachedWaypoint} reached`,
        waypointSequence: next.reachedWaypoint,
        isSimulated: true,
      });
      if (wp) {
        appendLog("PHOTO_CAPTURED", `Photo captured at waypoint ${next.reachedWaypoint}`);
        const drone = (drones.data ?? []).find((d) => d.id === m.drone_id);
        void MediaIngestionService.attach({
          organizationId: workspace.organization.id,
          projectId: p.id,
          missionId: m.id,
          flightId: flightIdRef.current,
          waypointSequence: wp.sequence,
          latitude: wp.latitude,
          longitude: wp.longitude,
          altitudeFt: wp.altitude_ft,
          heading: wp.heading,
          gimbalPitch: wp.gimbal_pitch,
          aircraft: drone ? `${drone.manufacturer} ${drone.model}` : null,
          camera: drone?.camera ?? null,
          fileUrl: SIMULATED_CAPTURE_IMAGES[wp.sequence % SIMULATED_CAPTURE_IMAGES.length]!,
        });
      }
    }

    if (next.flightMode === "RETURN_TO_HOME" && !log.some((l) => l.type === "RETURN_TO_HOME")) {
      appendLog("RETURN_TO_HOME", "Returning to home point");
    }

    if (next.finished) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      await telemetryRef.current?.ingest(
        {
          latitude: next.latitude,
          longitude: next.longitude,
          altitudeFt: 0,
          speedMph: 0,
          heading: next.heading,
          batteryPercent: next.batteryPercent,
          satelliteCount: next.satelliteCount,
          currentWaypoint: waypoints.length,
          flightMode: "LANDED",
          distanceFromHomeM: 0,
          missionProgress: 100,
        },
        true,
      );
      await FlightExecutionService.complete({
        flightId: flightIdRef.current,
        organizationId: workspace.organization.id,
        durationSeconds: next.elapsedSeconds,
        distanceMeters: next.distanceTravelledM,
        maxAltitudeFt: maxAltRef.current,
        photos: next.photos,
        batteryEnd: next.batteryPercent,
        completionPercent: 100,
        result: "completed",
        isSimulated: true,
      });
      appendLog("MISSION_COMPLETE", `Mission complete — ${next.photos} photos captured`);
      setPhase("complete");
      toast.success("Simulated flight recorded");
    }
  }

  async function abort() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (flightIdRef.current && workspace && state) {
      await FlightExecutionService.abort(
        flightIdRef.current,
        workspace.organization.id,
        Math.round(state.missionProgress),
        true,
      );
      appendLog("MISSION_ABORTED", "Mission aborted by operator");
    }
    setPhase("complete");
  }

  if (mission.isPending) {
    return (
      <AppShell title="Mission control">
        <LoadingPanel />
      </AppShell>
    );
  }

  const m = mission.data!;
  const p = project.data;

  return (
    <AppShell
      title={`Mission control — ${m.name}`}
      subtitle={`${p?.name ?? ""} • v${m.current_version} • simulated execution for dry runs and demos`}
      actions={
        <>
          <StatusChip
            label={phase === "preflight" ? "Preflight" : phase === "running" ? "In progress" : "Complete"}
            tone={phase === "running" ? "primary" : phase === "complete" ? "success" : "info"}
          />
          {phase === "running" ? (
            <button
              type="button"
              onClick={abort}
              className="rounded-sm border border-destructive/50 px-2.5 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.11em] text-destructive hover:bg-destructive/10"
            >
              Abort mission
            </button>
          ) : null}
          {phase === "complete" && flightId ? (
            <button
              type="button"
              onClick={() => navigate({ to: "/flights/$flightId", params: { flightId } })}
              className="rounded-sm bg-primary px-2.5 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.11em] text-primary-foreground"
            >
              Open flight record
            </button>
          ) : null}
        </>
      }
    >
      <SimulationBanner />

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Live view" dense>
          <SiteMap
            className="h-[440px] w-full"
            center={{
              latitude: m.takeoff_lat ?? p?.latitude ?? 39.829,
              longitude: m.takeoff_lng ?? p?.longitude ?? -104.933,
            }}
            zoom={16.2}
            waypoints={waypoints.map((w) => ({
              key: w.key,
              sequence: w.sequence,
              latitude: w.latitude,
              longitude: w.longitude,
            }))}
            trail={trail}
            aircraft={
              state && phase === "running"
                ? { latitude: state.latitude, longitude: state.longitude, heading: state.heading }
                : null
            }
            markers={
              m.takeoff_lat != null
                ? [{ latitude: m.takeoff_lat, longitude: m.takeoff_lng!, label: "TO", tone: "takeoff" as const }]
                : []
            }
          />
          <div className="grid grid-cols-2 gap-3 border-t border-border p-3 sm:grid-cols-4">
            <Metric label="Altitude" value={state ? `${Math.round(state.altitudeFt)} ft` : "—"} />
            <Metric label="Speed" value={state ? `${state.speedMph.toFixed(1)} mph` : "—"} />
            <Metric
              label="Battery"
              value={state ? `${state.batteryPercent}%` : "—"}
              tone={state && state.batteryPercent < 30 ? "warning" : "success"}
            />
            <Metric
              label="Progress"
              value={state ? `${Math.round(state.missionProgress)}%` : "0%"}
              hint={state ? `WP ${state.currentWaypoint}/${waypoints.length} · ${state.flightMode}` : ""}
            />
          </div>
        </Panel>

        <div className="space-y-3">
          {phase === "preflight" ? (
            <Panel title="Preflight checklist" dense>
              <ul className="divide-y divide-border">
                {PREFLIGHT_ITEMS.map((item) => (
                  <li key={item.key} className="flex items-center gap-2 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(checks[item.key])}
                      onChange={(e) => setChecks({ ...checks, [item.key]: e.target.checked })}
                      className="size-4"
                    />
                    <span className="text-sm text-foreground">{item.label}</span>
                  </li>
                ))}
              </ul>
              <div className="space-y-2 border-t border-border p-3">
                <label className="block">
                  <SectionLabel>Simulation speed</SectionLabel>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={speedMultiplier}
                    onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
                    className="mt-1 w-full"
                  />
                  <span className="font-mono text-[11px] text-muted-foreground">{speedMultiplier}× real time</span>
                </label>
                <button
                  type="button"
                  disabled={!allChecked || busy || !workspace?.canEdit}
                  onClick={startSimulation}
                  className="w-full rounded-sm bg-primary px-3 py-2.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground disabled:opacity-50"
                >
                  {busy ? "Starting…" : allChecked ? "Start simulated flight" : "Complete checklist to start"}
                </button>
              </div>
            </Panel>
          ) : (
            <Panel title="Telemetry readout" dense>
              <dl className="divide-y divide-border">
                <Readout label="Flight mode" value={state?.flightMode ?? "—"} />
                <Readout label="Heading" value={state ? `${Math.round(state.heading)}°` : "—"} />
                <Readout label="Satellites" value={state ? String(state.satelliteCount) : "—"} />
                <Readout
                  label="Distance from home"
                  value={state ? formatDistanceMeters(state.distanceFromHomeM) : "—"}
                />
                <Readout label="Distance flown" value={state ? formatDistanceMeters(state.distanceTravelledM) : "—"} />
                <Readout label="Elapsed" value={state ? formatDuration(state.elapsedSeconds) : "—"} />
                <Readout label="Photos captured" value={state ? String(state.photos) : "0"} />
              </dl>
            </Panel>
          )}

          <Panel title="Event stream" dense>
            <div className="max-h-72 divide-y divide-border overflow-y-auto">
              {log.length === 0 ? (
                <p className="px-3 py-6 text-sm text-muted-foreground">Events appear once the flight starts.</p>
              ) : (
                log.map((entry, idx) => (
                  <div key={`${entry.at}-${idx}`} className="flex items-start gap-2 px-3 py-2">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                    <div className="flex-1">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
                        {entry.type.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">{entry.message}</p>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {new Date(entry.at).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <dt className="font-display text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
        {label}
      </dt>
      <dd className="font-mono text-sm tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
