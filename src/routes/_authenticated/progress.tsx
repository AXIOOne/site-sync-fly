import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, LoadingPanel, Metric, Panel } from "@/components/app-shell";
import { StatusChip } from "@/components/status-chip";
import { mediaQuery, missionsQuery, projectsQuery } from "@/lib/queries";
import { formatDate, formatDateTime } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Progress Timeline — Aerial Site Ops" },
      {
        name: "description",
        content:
          "Compare identical waypoint viewpoints week over week with a wipe slider and a capture timeline for each construction site.",
      },
      { property: "og:title", content: "Progress Timeline — Aerial Site Ops" },
      {
        property: "og:description",
        content: "Waypoint-matched before/after comparison and a capture timeline for every site.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProgressTimeline,
});

const selectClass =
  "rounded-sm border border-border bg-input px-2 py-1 text-xs text-foreground outline-none focus:border-primary";

function ProgressTimeline() {
  const projects = useQuery(projectsQuery());
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    if (!projectId && projects.data?.[0]) setProjectId(projects.data[0].id);
  }, [projectId, projects.data]);

  const missions = useQuery({ ...missionsQuery(projectId || undefined), enabled: Boolean(projectId) });
  const media = useQuery({ ...mediaQuery({ projectId: projectId || undefined }), enabled: Boolean(projectId) });

  const [missionId, setMissionId] = useState("");
  const [viewpoint, setViewpoint] = useState("");
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [wipe, setWipe] = useState(50);

  const photos = useMemo(
    () =>
      (media.data ?? []).filter(
        (item) =>
          item.media_type === "photo" &&
          item.file_url &&
          (!missionId || item.mission_id === missionId) &&
          (!viewpoint || String(item.waypoint_sequence ?? "") === viewpoint),
      ),
    [media.data, missionId, viewpoint],
  );

  const viewpoints = useMemo(() => {
    const set = new Set<string>();
    for (const item of media.data ?? []) {
      if (missionId && item.mission_id !== missionId) continue;
      if (item.waypoint_sequence != null) set.add(String(item.waypoint_sequence));
    }
    return [...set].sort((a, b) => Number(a) - Number(b));
  }, [media.data, missionId]);

  const sorted = useMemo(
    () => [...photos].sort((a, b) => (a.captured_at ?? "").localeCompare(b.captured_at ?? "")),
    [photos],
  );

  useEffect(() => {
    if (sorted.length === 0) {
      setLeftId("");
      setRightId("");
      return;
    }
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    setLeftId((current) => (sorted.some((p) => p.id === current) ? current : first.id));
    setRightId((current) => (sorted.some((p) => p.id === current) ? current : last.id));
  }, [sorted]);

  const left = sorted.find((item) => item.id === leftId) ?? null;
  const right = sorted.find((item) => item.id === rightId) ?? null;

  const spanDays =
    left?.captured_at && right?.captured_at
      ? Math.abs(
          Math.round(
            (new Date(right.captured_at).getTime() - new Date(left.captured_at).getTime()) / 86_400_000,
          ),
        )
      : 0;

  return (
    <AppShell
      title="Progress timeline"
      subtitle="Repeatable missions fly the same waypoints, so captures line up for true week-over-week comparison."
      actions={
        <select
          className={selectClass}
          value={projectId}
          onChange={(event) => {
            setProjectId(event.target.value);
            setMissionId("");
            setViewpoint("");
          }}
          aria-label="Select site"
        >
          {(projects.data ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Captures in view" value={sorted.length} />
        <Metric label="Viewpoints" value={viewpoints.length} hint="Matched waypoints" tone="info" />
        <Metric label="Span" value={`${spanDays}d`} hint="Between selected frames" />
        <Metric
          label="Latest capture"
          value={sorted.length ? formatDate(sorted[sorted.length - 1]!.captured_at) : "—"}
        />
      </div>

      <Panel
        title="Viewpoint comparison"
        className="mt-3"
        action={
          <div className="flex flex-wrap gap-2">
            <select
              className={selectClass}
              value={missionId}
              onChange={(event) => {
                setMissionId(event.target.value);
                setViewpoint("");
              }}
              aria-label="Filter by mission"
            >
              <option value="">All missions</option>
              {(missions.data ?? []).map((mission) => (
                <option key={mission.id} value={mission.id}>
                  {mission.name}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={viewpoint}
              onChange={(event) => setViewpoint(event.target.value)}
              aria-label="Filter by waypoint"
            >
              <option value="">All viewpoints</option>
              {viewpoints.map((sequence) => (
                <option key={sequence} value={sequence}>
                  WP {sequence}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {media.isPending ? (
          <LoadingPanel />
        ) : !left || !right ? (
          <EmptyState
            title="Not enough captures"
            body="Fly the mission at least twice — or run a simulated flight — to compare the same viewpoint over time."
          />
        ) : (
          <div className="space-y-3">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md border border-border bg-panel">
              <img
                src={right.file_url ?? ""}
                alt={`Latest capture at waypoint ${right.waypoint_sequence ?? "n/a"}`}
                className="absolute inset-0 size-full object-cover"
              />
              <div
                className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-primary"
                style={{ width: `${wipe}%` }}
              >
                <img
                  src={left.file_url ?? ""}
                  alt={`Earlier capture at waypoint ${left.waypoint_sequence ?? "n/a"}`}
                  className="absolute inset-0 h-full w-[100vw] max-w-none object-cover"
                  style={{ width: `${(100 / Math.max(wipe, 1)) * 100}%` }}
                />
              </div>
              <span className="absolute bottom-2 left-2 rounded-sm bg-background/80 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-foreground">
                {formatDateTime(left.captured_at)}
              </span>
              <span className="absolute bottom-2 right-2 rounded-sm bg-background/80 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-foreground">
                {formatDateTime(right.captured_at)}
              </span>
            </div>

            <label className="block">
              <span className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Wipe
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={wipe}
                onChange={(event) => setWipe(Number(event.target.value))}
                className="mt-1 w-full accent-primary"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Earlier frame
                </span>
                <select
                  className={`${selectClass} mt-1 w-full`}
                  value={leftId}
                  onChange={(event) => setLeftId(event.target.value)}
                >
                  {sorted.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatDateTime(item.captured_at)} · WP {item.waypoint_sequence ?? "—"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Later frame
                </span>
                <select
                  className={`${selectClass} mt-1 w-full`}
                  value={rightId}
                  onChange={(event) => setRightId(event.target.value)}
                >
                  {sorted.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatDateTime(item.captured_at)} · WP {item.waypoint_sequence ?? "—"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Capture timeline" className="mt-3" dense>
        {sorted.length === 0 ? (
          <EmptyState title="No captures" body="Captures appear here after a flight uploads media." />
        ) : (
          <div className="flex gap-3 overflow-x-auto p-3">
            {sorted.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRightId(item.id)}
                className="w-40 shrink-0 overflow-hidden rounded-md border border-border bg-panel text-left transition-colors hover:border-primary"
              >
                <img
                  src={item.thumbnail_url ?? item.file_url ?? ""}
                  alt={`Capture on ${formatDate(item.captured_at)}`}
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                />
                <div className="p-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    {formatDate(item.captured_at)}
                  </p>
                  <StatusChip
                    className="mt-1"
                    label={`WP ${item.waypoint_sequence ?? "—"}`}
                    tone={item.id === rightId ? "primary" : "neutral"}
                    dot={false}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
