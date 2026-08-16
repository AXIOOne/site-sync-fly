import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, LoadingPanel, Metric, Panel, SectionLabel } from "@/components/app-shell";
import { StatusChip, toneForReadiness } from "@/components/status-chip";
import { SiteMap } from "@/components/map/site-map";
import {
  boundariesQuery,
  dronesQuery,
  missionQuery,
  missionVersionsQuery,
  pilotsQuery,
  projectQuery,
  schedulesQuery,
  waypointsQuery,
} from "@/lib/queries";
import {
  ACTION_LABELS,
  DAY_NAMES,
  FREQUENCY_LABELS,
  MISSION_TYPE_BLURB,
  MISSION_TYPE_LABELS,
  formatDateTime,
  formatDistanceMeters,
  formatDuration,
  type WaypointActionType,
} from "@/lib/domain";
import { centroid, ringFromGeoJson, SQM_TO_ACRES } from "@/lib/geo";
import {
  DEFAULT_GENERATION,
  HEADING_MODE_LABELS,
  capturesMedia,
  estimateFlight,
  evaluateReadiness,
  formatHeading,
  generateForType,
  newWaypointKey,
  resolveWaypointHeadings,
  withRotateBeforeCapture,
  type DraftWaypoint,
  type HeadingMode,
} from "@/lib/mission-planning";
import { dispatchAssignment, saveMissionVersion, upsertSchedule } from "@/lib/mission-mutations";
import {
  DJIMissionService,
  MissionExportService,
  MissionPackageService,
  WPMLGenerator,
  downloadTextFile,
} from "@/lib/services/mission-package";
import { useSession, useWorkspace } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/missions/$missionId")({
  head: () => ({
    meta: [
      { title: "Flight Planner — SiteView Missions" },
      {
        name: "description",
        content:
          "Plan waypoints on satellite imagery, set camera and safety parameters, check mission readiness and publish an immutable mission version.",
      },
      { property: "og:title", content: "Flight Planner — SiteView Missions" },
      {
        property: "og:description",
        content: "Waypoint planning, camera actions, readiness checks and versioned mission packages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Planner,
});

const ACTION_CHOICES: WaypointActionType[] = [
  "take_photo",
  "start_video",
  "stop_video",
  "rotate_aircraft",
  "rotate_gimbal",
  "hover",
];

function Planner() {
  const { missionId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: workspace } = useWorkspace(user?.id);

  const mission = useQuery(missionQuery(missionId));
  const projectId = mission.data?.project_id;
  const project = useQuery({ ...projectQuery(projectId ?? ""), enabled: Boolean(projectId) });
  const boundaries = useQuery({ ...boundariesQuery(projectId ?? ""), enabled: Boolean(projectId) });
  const stored = useQuery(waypointsQuery(missionId));
  const versions = useQuery(missionVersionsQuery(missionId));
  const drones = useQuery(dronesQuery());
  const pilots = useQuery(pilotsQuery());
  const schedules = useQuery({ ...schedulesQuery(projectId ?? ""), enabled: Boolean(projectId) });

  const [draft, setDraft] = useState<DraftWaypoint[] | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [aimMode, setAimMode] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<null | {
    name: string;
    altitude_ft: number;
    speed_mph: number;
    gimbal_pitch: number;
    camera_mode: string;
    photo_interval_seconds: number | null;
    aircraft_heading: string;
    rth_altitude_ft: number;
    front_overlap: number;
    side_overlap: number;
    flight_direction: number;
    drone_id: string;
    pilot_id: string;
    is_repeatable: boolean;
    repeat_frequency: string;
    weather_reviewed: boolean;
    airspace_reviewed: boolean;
  }>(null);

  useEffect(() => {
    if (!mission.data || settings) return;
    const m = mission.data;
    setSettings({
      name: m.name,
      altitude_ft: Number(m.altitude_ft),
      speed_mph: Number(m.speed_mph),
      gimbal_pitch: Number(m.gimbal_pitch),
      camera_mode: m.camera_mode,
      photo_interval_seconds: m.photo_interval_seconds == null ? null : Number(m.photo_interval_seconds),
      aircraft_heading: m.aircraft_heading,
      rth_altitude_ft: Number(m.rth_altitude_ft),
      front_overlap: m.front_overlap ?? 75,
      side_overlap: m.side_overlap ?? 65,
      flight_direction: m.flight_direction ?? 0,
      drone_id: m.drone_id ?? "",
      pilot_id: m.pilot_id ?? "",
      is_repeatable: m.is_repeatable,
      repeat_frequency: m.repeat_frequency,
      weather_reviewed: m.weather_reviewed,
      airspace_reviewed: m.airspace_reviewed,
    });
  }, [mission.data, settings]);

  useEffect(() => {
    if (draft || !stored.data) return;
    setDraft(
      (stored.data as any[]).map((w) => ({
        key: w.id,
        sequence: w.sequence,
        latitude: w.latitude,
        longitude: w.longitude,
        altitude_ft: Number(w.altitude_ft),
        heading: w.heading == null ? null : Number(w.heading),
        heading_mode: (w.heading == null ? "path" : "fixed") as HeadingMode,
        gimbal_pitch: Number(w.gimbal_pitch ?? -45),
        speed_mph: w.speed_mph == null ? null : Number(w.speed_mph),
        label: w.label,
        actions: (w.waypoint_actions ?? [])
          .slice()
          .sort((a: any, b: any) => a.sequence - b.sequence)
          .map((a: any) => ({
            action_type: a.action_type,
            param_numeric: a.param_numeric == null ? null : Number(a.param_numeric),
          })),
      })),
    );
  }, [stored.data, draft]);

  const rings = useMemo(
    () =>
      (boundaries.data ?? [])
        .map((b) => ({ ring: ringFromGeoJson(b.geojson), label: b.label, kind: b.kind }))
        .filter((b): b is { ring: [number, number][]; label: string; kind: string } => Boolean(b.ring)),
    [boundaries.data],
  );
  const siteRing = rings.find((r) => r.kind === "site")?.ring ?? rings[0]?.ring ?? null;
  const siteCenter = useMemo(() => (siteRing ? centroid(siteRing) : null), [siteRing]);

  const waypoints = draft ?? [];
  const selectedDrone = (drones.data ?? []).find((d) => d.id === settings?.drone_id);
  const estimate = useMemo(
    () =>
      estimateFlight(waypoints, {
        speed_mph: settings?.speed_mph ?? 12,
        ring: siteRing,
        batteryMinutes: selectedDrone?.battery_capacity_minutes ?? 35,
      }),
    [waypoints, settings?.speed_mph, siteRing, selectedDrone?.battery_capacity_minutes],
  );

  const readiness = useMemo(
    () =>
      evaluateReadiness({
        takeoffDefined: mission.data?.takeoff_lat != null,
        landingDefined: mission.data?.landing_lat != null,
        rthAltitudeFt: settings?.rth_altitude_ft ?? null,
        waypointCount: waypoints.length,
        droneAssigned: Boolean(settings?.drone_id),
        pilotAssigned: Boolean(settings?.pilot_id),
        settingsComplete: Boolean(settings && settings.altitude_ft > 0 && settings.speed_mph > 0),
        estimatedBatteryPercent: estimate.batteryPercent,
        weatherReviewed: Boolean(settings?.weather_reviewed),
        airspaceReviewed: Boolean(settings?.airspace_reviewed),
        preflightCompleted: false,
        waypointsMissingHeading: waypoints.filter((w) => capturesMedia(w) && w.heading == null).length,
      }),
    [mission.data, settings, waypoints, estimate.batteryPercent],
  );

  if (mission.isPending || !settings) {
    return (
      <AppShell title="Flight planner">
        <LoadingPanel />
      </AppShell>
    );
  }

  const m = mission.data!;
  const p = project.data;
  const schedule = (schedules.data ?? []).find((s: any) => s.mission_id === missionId) as any;

  function resequence(list: DraftWaypoint[]): DraftWaypoint[] {
    return withHeadings(list.map((w, i) => ({ ...w, sequence: i + 1 })));
  }

  /** Recompute headings for waypoints whose mode derives them from geometry. */
  function withHeadings(list: DraftWaypoint[]): DraftWaypoint[] {
    return resolveWaypointHeadings(list, siteCenter);
  }

  function regenerate() {
    if (!siteRing) {
      toast.error("This project has no site boundary to generate from");
      return;
    }
    const generated = generateForType(m.mission_type, siteRing, {
      ...DEFAULT_GENERATION,
      altitude_ft: settings!.altitude_ft,
      speed_mph: settings!.speed_mph,
      gimbal_pitch: settings!.gimbal_pitch,
      front_overlap: settings!.front_overlap,
      side_overlap: settings!.side_overlap,
      flight_direction: settings!.flight_direction,
      pointToCenter: settings!.aircraft_heading === "point_to_center",
    });
    if (generated.length === 0) {
      toast.error("No waypoints generated for this mission type");
      return;
    }
    setDraft(generated);
    setSelectedKey(generated[0]?.key ?? null);
    toast.success(`Generated ${generated.length} waypoints`);
  }

  async function save() {
    if (!workspace?.canEdit) {
      toast.error("Your role is read-only");
      return;
    }
    setSaving(true);
    try {
      await saveMissionVersion({
        mission: m,
        settings: {
          name: settings!.name,
          altitude_ft: settings!.altitude_ft,
          speed_mph: settings!.speed_mph,
          gimbal_pitch: settings!.gimbal_pitch,
          camera_mode: settings!.camera_mode,
          photo_interval_seconds: settings!.photo_interval_seconds,
          aircraft_heading: settings!.aircraft_heading,
          rth_altitude_ft: settings!.rth_altitude_ft,
          front_overlap: settings!.front_overlap,
          side_overlap: settings!.side_overlap,
          flight_direction: settings!.flight_direction,
          drone_id: settings!.drone_id || null,
          pilot_id: settings!.pilot_id || null,
          is_repeatable: settings!.is_repeatable,
          repeat_frequency: settings!.repeat_frequency as any,
          takeoff_lat: m.takeoff_lat,
          takeoff_lng: m.takeoff_lng,
          landing_lat: m.landing_lat,
          landing_lng: m.landing_lng,
          rth_lat: m.rth_lat,
          rth_lng: m.rth_lng,
          weather_reviewed: settings!.weather_reviewed,
          airspace_reviewed: settings!.airspace_reviewed,
          readiness_state: readiness.state,
        },
        waypoints,
        estimate,
        changeNote,
        userId: user?.id ?? null,
      });
      setChangeNote("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mission", missionId] }),
        queryClient.invalidateQueries({ queryKey: ["mission-versions", missionId] }),
        queryClient.invalidateQueries({ queryKey: ["waypoints", missionId] }),
      ]);
      toast.success(`Published version ${m.current_version + 1}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function buildPackage() {
    const latestVersion = (versions.data ?? [])[0] ?? null;
    return MissionPackageService.build({
      mission: m,
      version: latestVersion as any,
      project: p!,
      drone: (drones.data ?? []).find((d) => d.id === settings!.drone_id) ?? null,
      pilot: (pilots.data ?? []).find((pl) => pl.id === settings!.pilot_id) ?? null,
      waypoints: waypoints.map((w) => ({
        sequence: w.sequence,
        latitude: w.latitude,
        longitude: w.longitude,
        altitude_ft: w.altitude_ft,
        heading: w.heading,
        gimbal_pitch: w.gimbal_pitch,
        speed_mph: w.speed_mph,
        label: w.label,
        actions: withRotateBeforeCapture(w).map((a, i) => ({
          sequence: i + 1,
          action_type: a.action_type,
          param_numeric: a.param_numeric ?? null,
        })),
      })),
    });
  }

  function exportAs(kind: "wpml" | "kml" | "geojson" | "json") {
    if (!p) return;
    const pkg = buildPackage();
    const base = `${m.name.replace(/\s+/g, "-").toLowerCase()}-v${pkg.missionVersion.versionNumber}`;
    if (kind === "wpml") downloadTextFile(`${base}.wpml.kml`, WPMLGenerator.generate(pkg), "application/vnd.google-earth.kml+xml");
    if (kind === "kml") downloadTextFile(`${base}.kml`, MissionExportService.toKml(pkg), "application/vnd.google-earth.kml+xml");
    if (kind === "geojson")
      downloadTextFile(`${base}.geojson`, JSON.stringify(MissionExportService.toGeoJson(pkg), null, 2), "application/geo+json");
    if (kind === "json")
      downloadTextFile(`${base}.package.json`, JSON.stringify(DJIMissionService.buildAgentPayload(pkg), null, 2), "application/json");
    toast.success("Export downloaded");
  }

  async function dispatch() {
    if (!workspace || !p) return;
    try {
      const latestVersion = (versions.data ?? [])[0] as any;
      await dispatchAssignment({
        organizationId: workspace.organization.id,
        projectId: p.id,
        missionId,
        missionVersionId: latestVersion?.id ?? null,
        pilotId: settings!.pilot_id || null,
        droneId: settings!.drone_id || null,
        scheduledFor: new Date().toISOString(),
        notes: "Dispatched to Flight Agent queue from planner",
      });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast.success("Assignment queued for the Flight Agent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dispatch failed");
    }
  }

  const selected = waypoints.find((w) => w.key === selectedKey) ?? null;

  return (
    <AppShell
      title={settings.name}
      subtitle={`${MISSION_TYPE_LABELS[m.mission_type]} • ${p?.name ?? ""} • v${m.current_version} • ${MISSION_TYPE_BLURB[m.mission_type]}`}
      actions={
        <>
          <StatusChip label={readiness.state.replace("_", " ")} tone={toneForReadiness(readiness.state)} />
          <button
            type="button"
            onClick={() =>
              navigate({ to: "/simulate/$missionId", params: { missionId } })
            }
            className="rounded-sm border border-border px-2.5 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.11em] text-foreground hover:bg-secondary"
          >
            Simulate flight
          </button>
          <button
            type="button"
            onClick={dispatch}
            className="rounded-sm border border-border px-2.5 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.11em] text-foreground hover:bg-secondary"
          >
            Dispatch to agent
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-sm bg-primary px-2.5 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.11em] text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? "Publishing…" : `Publish v${m.current_version + 1}`}
          </button>
        </>
      }
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <div className="space-y-3">
          <Panel
            title="Plan"
            dense
            action={
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setAimMode(false);
                    setAddMode(!addMode);
                  }}
                  className={
                    "rounded-sm border px-2 py-0.5 font-display text-[10px] uppercase tracking-[0.11em] " +
                    (addMode ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground")
                  }
                >
                  {addMode ? "Click map to add" : "Add waypoint"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedKey) {
                      toast.error("Select a waypoint first");
                      return;
                    }
                    setAddMode(false);
                    setAimMode(!aimMode);
                  }}
                  className={
                    "rounded-sm border px-2 py-0.5 font-display text-[10px] uppercase tracking-[0.11em] " +
                    (aimMode ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground")
                  }
                >
                  {aimMode ? "Click map to aim" : "Aim at target"}
                </button>
                <button
                  type="button"
                  onClick={regenerate}
                  className="rounded-sm border border-border px-2 py-0.5 font-display text-[10px] uppercase tracking-[0.11em] text-muted-foreground hover:text-foreground"
                >
                  Auto-generate
                </button>
              </div>
            }
          >
            <SiteMap
              className="h-[460px] w-full"
              center={{
                latitude: m.takeoff_lat ?? p?.latitude ?? 39.829,
                longitude: m.takeoff_lng ?? p?.longitude ?? -104.933,
              }}
              zoom={16}
              boundaries={rings}
              editable
              drawMode={addMode}
              aimMode={aimMode}
              waypoints={waypoints.map((w) => ({
                key: w.key,
                sequence: w.sequence,
                latitude: w.latitude,
                longitude: w.longitude,
                heading: w.heading,
                aim:
                  w.heading_mode === "aim" && w.aim_lat != null && w.aim_lng != null
                    ? { latitude: w.aim_lat, longitude: w.aim_lng }
                    : null,
              }))}
              onWaypointHeadingChange={(key, degrees) =>
                setDraft((list) =>
                  withHeadings(
                    (list ?? []).map((w) =>
                      w.key === key
                        ? { ...w, heading: degrees, heading_mode: "fixed", aim_lat: null, aim_lng: null }
                        : w,
                    ),
                  ),
                )
              }
              onAimPointPicked={(key, point) => {
                setDraft((list) =>
                  withHeadings(
                    (list ?? []).map((w) =>
                      w.key === key
                        ? { ...w, heading_mode: "aim", aim_lat: point.latitude, aim_lng: point.longitude }
                        : w,
                    ),
                  ),
                );
                setAimMode(false);
                toast.success("Aim target set");
              }}
              markers={[
                ...(m.takeoff_lat != null
                  ? [{ latitude: m.takeoff_lat, longitude: m.takeoff_lng!, label: "TO", tone: "takeoff" as const }]
                  : []),
                ...(m.rth_lat != null
                  ? [{ latitude: m.rth_lat, longitude: m.rth_lng!, label: "RTH", tone: "rth" as const }]
                  : []),
              ]}
              selectedWaypointKey={selectedKey}
              onWaypointClick={setSelectedKey}
              onWaypointDragEnd={(key, point) =>
                setDraft((list) =>
                  withHeadings(
                    (list ?? []).map((w) =>
                      w.key === key ? { ...w, latitude: point.latitude, longitude: point.longitude } : w,
                    ),
                  ),
                )
              }
              onMapClick={(point) => {
                if (!addMode) return;
                setDraft((list) => {
                  const next = [
                    ...(list ?? []),
                    {
                      key: newWaypointKey(),
                      sequence: (list?.length ?? 0) + 1,
                      latitude: point.latitude,
                      longitude: point.longitude,
                      altitude_ft: settings!.altitude_ft,
                      heading: null,
                      heading_mode: (settings!.aircraft_heading === "point_to_center"
                        ? "center"
                        : "path") as HeadingMode,
                      gimbal_pitch: settings!.gimbal_pitch,
                      speed_mph: settings!.speed_mph,
                      label: null,
                      actions: [{ action_type: "take_photo" as WaypointActionType }],
                    },
                  ];
                  return resequence(next);
                });
              }}
            />
          </Panel>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Waypoints" value={estimate.waypointCount} />
            <Metric label="Est. distance" value={formatDistanceMeters(estimate.distanceMeters)} hint="Planning estimate" />
            <Metric label="Est. duration" value={formatDuration(estimate.durationSeconds)} hint="Planning estimate" />
            <Metric
              label="Est. battery"
              value={`${estimate.batteryPercent}%`}
              tone={estimate.batteryPercent > 80 ? "warning" : "success"}
              hint={`${(estimate.areaSqMeters * SQM_TO_ACRES).toFixed(1)} acres covered`}
            />
          </div>

          <Panel title={`Waypoints (${waypoints.length})`} dense>
            <div className="max-h-80 overflow-y-auto divide-y divide-border">
              {waypoints.map((w) => (
                <div
                  key={w.key}
                  className={
                    "flex flex-wrap items-center gap-2 px-3 py-2 " +
                    (selectedKey === w.key ? "bg-secondary/70" : "hover:bg-secondary/40")
                  }
                >
                  <button
                    type="button"
                    onClick={() => setSelectedKey(w.key)}
                    className="w-8 text-left font-mono text-xs font-semibold text-primary"
                  >
                    {String(w.sequence).padStart(2, "0")}
                  </button>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {w.latitude.toFixed(5)}, {w.longitude.toFixed(5)}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">{w.altitude_ft} ft</span>
                  <span className="font-mono text-[11px] text-muted-foreground">gimbal {w.gimbal_pitch}°</span>
                  <span
                    className={
                      "font-mono text-[11px] " +
                      (w.heading == null && capturesMedia(w) ? "text-warning" : "text-muted-foreground")
                    }
                    title={HEADING_MODE_LABELS[w.heading_mode]}
                  >
                    {formatHeading(w.heading)}
                  </span>
                  <span className="flex-1 truncate text-[11px] text-muted-foreground">
                    {w.actions.map((a) => ACTION_LABELS[a.action_type]).join(", ") || "No actions"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDraft((list) => resequence((list ?? []).filter((x) => x.key !== w.key)))}
                    className="font-display text-[10px] uppercase tracking-[0.11em] text-destructive"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {waypoints.length === 0 ? (
                <p className="px-3 py-6 text-sm text-muted-foreground">
                  No waypoints. Use auto-generate or add them on the map.
                </p>
              ) : null}
            </div>
          </Panel>

          {selected ? (
            <Panel title={`Waypoint ${String(selected.sequence).padStart(2, "0")}`}>
              <div className="grid gap-3 sm:grid-cols-3">
                <NumberField
                  label="Altitude (ft)"
                  value={selected.altitude_ft}
                  onChange={(v) => patchWaypoint(setDraft, selected.key, { altitude_ft: v })}
                />
                <NumberField
                  label="Gimbal pitch (°)"
                  value={selected.gimbal_pitch}
                  onChange={(v) => patchWaypoint(setDraft, selected.key, { gimbal_pitch: v })}
                />
                <NumberField
                  label="Speed (mph)"
                  value={selected.speed_mph ?? settings.speed_mph}
                  onChange={(v) => patchWaypoint(setDraft, selected.key, { speed_mph: v })}
                />
                <div className="sm:col-span-3 rounded-sm border border-border p-2.5">
                  <SectionLabel>Camera orientation</SectionLabel>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {(["fixed", "aim", "center", "path"] as HeadingMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setDraft((list) =>
                            withHeadings(
                              (list ?? []).map((w) =>
                                w.key === selected!.key
                                  ? {
                                      ...w,
                                      heading_mode: mode,
                                      heading: mode === "fixed" ? (w.heading ?? 0) : w.heading,
                                    }
                                  : w,
                              ),
                            ),
                          );
                          if (mode === "aim") setAimMode(true);
                        }}
                        className={
                          "rounded-sm border px-2 py-0.5 font-display text-[10px] uppercase tracking-[0.11em] " +
                          (selected!.heading_mode === mode
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground")
                        }
                      >
                        {HEADING_MODE_LABELS[mode]}
                      </button>
                    ))}
                  </div>

                  <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <label className="block">
                      <SectionLabel>Heading — {formatHeading(selected.heading)}</SectionLabel>
                      <input
                        type="range"
                        min={0}
                        max={359}
                        value={Math.round(selected.heading ?? 0)}
                        onChange={(e) =>
                          patchWaypoint(setDraft, selected!.key, {
                            heading: Number(e.target.value),
                            heading_mode: "fixed",
                            aim_lat: null,
                            aim_lng: null,
                          })
                        }
                        className="mt-1 w-full accent-primary"
                      />
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {COMPASS_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            patchWaypoint(setDraft, selected!.key, {
                              heading: preset.degrees,
                              heading_mode: "fixed",
                              aim_lat: null,
                              aim_lng: null,
                            })
                          }
                          className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAddMode(false);
                        setAimMode(!aimMode);
                      }}
                      className={
                        "rounded-sm border px-2 py-0.5 font-display text-[10px] uppercase tracking-[0.11em] " +
                        (aimMode ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground")
                      }
                    >
                      {aimMode ? "Click map to pick target" : "Pick aim target on map"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((list) =>
                          withHeadings(
                            (list ?? []).map((w) => ({
                              ...w,
                              heading_mode: selected!.heading_mode,
                              heading: selected!.heading_mode === "fixed" ? selected!.heading : w.heading,
                              aim_lat: selected!.aim_lat ?? null,
                              aim_lng: selected!.aim_lng ?? null,
                            })),
                          ),
                        )
                      }
                      className="rounded-sm border border-border px-2 py-0.5 font-display text-[10px] uppercase tracking-[0.11em] text-muted-foreground hover:text-foreground"
                    >
                      Apply to all waypoints
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    Drag the round handle on the map to spin the aircraft. A{" "}
                    <span className="font-mono">rotate_aircraft</span> action is written before every photo or video
                    action on export, so the aircraft is settled on this heading before capture.
                  </p>
                </div>
                <label className="block sm:col-span-2">
                  <SectionLabel>Label</SectionLabel>
                  <input
                    value={selected.label ?? ""}
                    onChange={(e) => patchWaypoint(setDraft, selected.key, { label: e.target.value || null })}
                    className="mt-1 w-full rounded-sm border border-input bg-card px-2.5 py-1.5 text-sm text-foreground"
                  />
                </label>
              </div>
              <div className="mt-3">
                <SectionLabel>Actions at this waypoint</SectionLabel>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {ACTION_CHOICES.map((choice) => {
                    const on = selected.actions.some((a) => a.action_type === choice);
                    return (
                      <button
                        key={choice}
                        type="button"
                        onClick={() =>
                          patchWaypoint(setDraft, selected.key, {
                            actions: on
                              ? selected.actions.filter((a) => a.action_type !== choice)
                              : [...selected.actions, { action_type: choice, param_numeric: choice === "hover" ? 3 : null }],
                          })
                        }
                        className={
                          "rounded-sm border px-2 py-0.5 font-display text-[10px] uppercase tracking-[0.11em] " +
                          (on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground")
                        }
                      >
                        {ACTION_LABELS[choice]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-3">
          <Panel title="Mission readiness" dense>
            <ul className="divide-y divide-border">
              {readiness.checks.map((check) => (
                <li key={check.key} className="flex items-center gap-2 px-3 py-2">
                  <span
                    className={
                      "size-2 rounded-full " +
                      (check.passed ? "bg-success" : check.severity === "blocking" ? "bg-destructive" : "bg-warning")
                    }
                  />
                  <span className="flex-1 text-sm text-foreground">{check.label}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{check.detail ?? ""}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Mission parameters">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <SectionLabel>Mission name</SectionLabel>
                <input
                  value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  className="mt-1 w-full rounded-sm border border-input bg-card px-2.5 py-1.5 text-sm text-foreground"
                />
              </label>
              <NumberField
                label="Altitude (ft)"
                value={settings.altitude_ft}
                onChange={(v) => setSettings({ ...settings, altitude_ft: v })}
              />
              <NumberField
                label="Speed (mph)"
                value={settings.speed_mph}
                onChange={(v) => setSettings({ ...settings, speed_mph: v })}
              />
              <NumberField
                label="Gimbal pitch (°)"
                value={settings.gimbal_pitch}
                onChange={(v) => setSettings({ ...settings, gimbal_pitch: v })}
              />
              <NumberField
                label="RTH altitude (ft)"
                value={settings.rth_altitude_ft}
                onChange={(v) => setSettings({ ...settings, rth_altitude_ft: v })}
              />
              <label className="block">
                <SectionLabel>Camera mode</SectionLabel>
                <select
                  value={settings.camera_mode}
                  onChange={(e) => setSettings({ ...settings, camera_mode: e.target.value })}
                  className="mt-1 w-full rounded-sm border border-input bg-card px-2.5 py-1.5 text-sm text-foreground"
                >
                  <option value="photo_at_waypoint">Photo at waypoint</option>
                  <option value="timed_interval">Timed interval</option>
                  <option value="distance_interval">Distance interval</option>
                  <option value="video">Continuous video</option>
                </select>
              </label>
              <label className="block">
                <SectionLabel>Aircraft heading</SectionLabel>
                <select
                  value={settings.aircraft_heading}
                  onChange={(e) => setSettings({ ...settings, aircraft_heading: e.target.value })}
                  className="mt-1 w-full rounded-sm border border-input bg-card px-2.5 py-1.5 text-sm text-foreground"
                >
                  <option value="point_to_center">Point to site center</option>
                  <option value="follow_route">Follow route</option>
                  <option value="manual">Manual per waypoint</option>
                </select>
              </label>
              {m.mission_type === "mapping" ? (
                <>
                  <NumberField
                    label="Front overlap (%)"
                    value={settings.front_overlap}
                    onChange={(v) => setSettings({ ...settings, front_overlap: v })}
                  />
                  <NumberField
                    label="Side overlap (%)"
                    value={settings.side_overlap}
                    onChange={(v) => setSettings({ ...settings, side_overlap: v })}
                  />
                  <NumberField
                    label="Flight direction (°)"
                    value={settings.flight_direction}
                    onChange={(v) => setSettings({ ...settings, flight_direction: v })}
                  />
                </>
              ) : null}
              <label className="block">
                <SectionLabel>Aircraft</SectionLabel>
                <select
                  value={settings.drone_id}
                  onChange={(e) => setSettings({ ...settings, drone_id: e.target.value })}
                  className="mt-1 w-full rounded-sm border border-input bg-card px-2.5 py-1.5 text-sm text-foreground"
                >
                  <option value="">Unassigned</option>
                  {(drones.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.manufacturer} {d.model} {d.has_rtk ? "(RTK)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <SectionLabel>Pilot</SectionLabel>
                <select
                  value={settings.pilot_id}
                  onChange={(e) => setSettings({ ...settings, pilot_id: e.target.value })}
                  className="mt-1 w-full rounded-sm border border-input bg-card px-2.5 py-1.5 text-sm text-foreground"
                >
                  <option value="">Unassigned</option>
                  {(pilots.data ?? []).map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <Toggle
                label="Weather reviewed"
                value={settings.weather_reviewed}
                onChange={(v) => setSettings({ ...settings, weather_reviewed: v })}
              />
              <Toggle
                label="Airspace reviewed"
                value={settings.airspace_reviewed}
                onChange={(v) => setSettings({ ...settings, airspace_reviewed: v })}
              />
              <label className="block sm:col-span-2">
                <SectionLabel>Version note</SectionLabel>
                <input
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  placeholder="What changed in this version?"
                  className="mt-1 w-full rounded-sm border border-input bg-card px-2.5 py-1.5 text-sm text-foreground"
                />
              </label>
            </div>
          </Panel>

          <Panel title="Repeat schedule">
            <ScheduleEditor
              organizationId={workspace?.organization.id ?? ""}
              projectId={p?.id ?? ""}
              missionId={missionId}
              schedule={schedule ?? null}
              onSaved={() => queryClient.invalidateQueries({ queryKey: ["schedules"] })}
            />
          </Panel>

          <Panel title="Export mission package" dense>
            <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
              The Flight Agent downloads the same package over the API. These exports are for DJI Pilot 2, GIS tools and
              record keeping.
            </p>
            <div className="grid grid-cols-2 gap-2 p-3">
              {(["wpml", "kml", "geojson", "json"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => exportAs(kind)}
                  className="rounded-sm border border-border px-2.5 py-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.11em] text-foreground hover:bg-secondary"
                >
                  {kind === "json" ? "Agent payload" : kind.toUpperCase()}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Version history" dense>
            <div className="max-h-64 divide-y divide-border overflow-y-auto">
              {(versions.data ?? []).map((v: any) => (
                <div key={v.id} className="px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs font-semibold text-foreground">v{v.version_number}</p>
                    <span className="font-mono text-[10px] text-muted-foreground">{formatDateTime(v.created_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{v.change_note}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {v.waypoint_count} wp • {formatDistanceMeters(Number(v.estimated_distance_m))} •{" "}
                    {formatDuration(Number(v.estimated_duration_s))}
                  </p>
                </div>
              ))}
              {(versions.data ?? []).length === 0 ? (
                <p className="px-3 py-5 text-sm text-muted-foreground">No published versions yet.</p>
              ) : null}
            </div>
          </Panel>

          <Link
            to="/projects/$projectId"
            params={{ projectId: p?.id ?? "" }}
            className="block text-center font-display text-[11px] uppercase tracking-[0.12em] text-primary"
          >
            Back to project
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function patchWaypoint(
  setDraft: React.Dispatch<React.SetStateAction<DraftWaypoint[] | null>>,
  key: string,
  patch: Partial<DraftWaypoint>,
) {
  setDraft((list) => (list ?? []).map((w) => (w.key === key ? { ...w, ...patch } : w)));
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <SectionLabel>{label}</SectionLabel>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-sm border border-input bg-card px-2.5 py-1.5 font-mono text-sm text-foreground"
      />
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 pt-4">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="size-4" />
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}

function ScheduleEditor({
  organizationId,
  projectId,
  missionId,
  schedule,
  onSaved,
}: {
  organizationId: string;
  projectId: string;
  missionId: string;
  schedule: any | null;
  onSaved: () => void;
}) {
  const [frequency, setFrequency] = useState<string>(schedule?.frequency ?? "weekly");
  const [dayOfWeek, setDayOfWeek] = useState<number>(schedule?.day_of_week ?? 2);
  const [timeOfDay, setTimeOfDay] = useState<string>((schedule?.time_of_day ?? "09:00:00").slice(0, 5));
  const [isActive, setIsActive] = useState<boolean>(schedule?.is_active ?? true);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <SectionLabel>Frequency</SectionLabel>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="mt-1 w-full rounded-sm border border-input bg-card px-2.5 py-1.5 text-sm text-foreground"
          >
            {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <SectionLabel>Day of week</SectionLabel>
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(Number(e.target.value))}
            disabled={frequency === "daily" || frequency === "manual"}
            className="mt-1 w-full rounded-sm border border-input bg-card px-2.5 py-1.5 text-sm text-foreground disabled:opacity-50"
          >
            {DAY_NAMES.map((name, idx) => (
              <option key={name} value={idx}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <SectionLabel>Time</SectionLabel>
          <input
            type="time"
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(e.target.value)}
            className="mt-1 w-full rounded-sm border border-input bg-card px-2.5 py-1.5 font-mono text-sm text-foreground"
          />
        </label>
        <Toggle label="Schedule active" value={isActive} onChange={setIsActive} />
      </div>
      <button
        type="button"
        disabled={busy || !organizationId || !projectId}
        onClick={async () => {
          setBusy(true);
          try {
            const next = await upsertSchedule({
              organizationId,
              projectId,
              missionId,
              scheduleId: schedule?.id ?? null,
              frequency: frequency as any,
              dayOfWeek: frequency === "daily" || frequency === "manual" ? null : dayOfWeek,
              timeOfDay: `${timeOfDay}:00`,
              isActive,
            });
            onSaved();
            toast.success(next ? `Next run ${formatDateTime(next)}` : "Schedule set to manual");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not save schedule");
          } finally {
            setBusy(false);
          }
        }}
        className="w-full rounded-sm border border-border px-2.5 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.11em] text-foreground hover:bg-secondary disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save schedule"}
      </button>
      {schedule?.next_occurrence ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          Next occurrence {formatDateTime(schedule.next_occurrence)}
        </p>
      ) : null}
    </div>
  );
}
