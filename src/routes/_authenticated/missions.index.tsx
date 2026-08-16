import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, EmptyState, LoadingPanel, Metric, Panel } from "@/components/app-shell";
import { StatusChip } from "@/components/status-chip";
import { useSession, useWorkspace } from "@/hooks/useSession";
import { missionsQuery, projectsQuery, schedulesQuery } from "@/lib/queries";
import { createMission } from "@/lib/mission-mutations";
import {
  FREQUENCY_LABELS,
  MISSION_TYPE_LABELS,
  formatDate,
  formatDateTime,
  type MissionType,
  type ScheduleFrequency,
} from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/missions/")({
  head: () => ({
    meta: [
      { title: "Mission Library — Aerial Site Ops" },
      {
        name: "description",
        content:
          "Every repeatable drone mission across all construction sites, with version numbers, readiness state and recurring schedules.",
      },
      { property: "og:title", content: "Mission Library — Aerial Site Ops" },
      {
        property: "og:description",
        content: "Repeatable mission templates across all sites with versions, readiness and schedules.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MissionLibrary,
});

const inputClass =
  "w-full rounded-sm border border-border bg-input px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary";
const labelClass = "font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";
const buttonClass =
  "rounded-sm border border-primary/50 bg-primary/15 px-3 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.11em] text-primary transition-colors hover:bg-primary/25 disabled:opacity-50";

const MISSION_TYPES: MissionType[] = [
  "weekly_progress",
  "mapping",
  "site_perimeter",
  "point_inspection",
  "custom",
];
const FREQUENCIES: ScheduleFrequency[] = ["manual", "daily", "weekly", "biweekly", "monthly"];

function MissionLibrary() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: workspace } = useWorkspace(user?.id);

  const projects = useQuery(projectsQuery());
  const missions = useQuery(missionsQuery());
  const schedules = useQuery(schedulesQuery());

  const [projectFilter, setProjectFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [missionType, setMissionType] = useState<MissionType>("weekly_progress");
  const [frequency, setFrequency] = useState<ScheduleFrequency>("weekly");

  const projectName = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects.data ?? []) map.set(project.id, project.name);
    return map;
  }, [projects.data]);

  const filtered = (missions.data ?? []).filter(
    (mission) =>
      (!projectFilter || mission.project_id === projectFilter) &&
      (!typeFilter || mission.mission_type === typeFilter),
  );

  const create = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error("Workspace not ready");
      const project = (projects.data ?? []).find((p) => p.id === projectId);
      if (!project) throw new Error("Pick a site");
      return createMission({
        organizationId: workspace.organization.id,
        projectId: project.id,
        name: name.trim(),
        missionType,
        isRepeatable: frequency !== "manual",
        repeatFrequency: frequency,
        takeoff:
          project.latitude != null && project.longitude != null
            ? { latitude: project.latitude, longitude: project.longitude }
            : null,
      });
    },
    onSuccess: (mission) => {
      toast.success("Mission created — plan the waypoints");
      void queryClient.invalidateQueries({ queryKey: ["missions"] });
      void navigate({ to: "/missions/$missionId", params: { missionId: mission.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Mission library"
      subtitle="Repeatable mission templates across every site. Versions are immutable so week-over-week captures stay comparable."
      actions={
        <button type="button" className={buttonClass} onClick={() => setCreating((open) => !open)}>
          {creating ? "Close" : "New mission"}
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Missions" value={missions.data?.length ?? 0} />
        <Metric
          label="Repeatable"
          value={(missions.data ?? []).filter((m) => m.is_repeatable).length}
          tone="info"
        />
        <Metric
          label="Flight ready"
          value={(missions.data ?? []).filter((m) => m.readiness_state === "READY").length}
          tone="success"
        />
        <Metric
          label="Active schedules"
          value={(schedules.data ?? []).filter((s) => s.is_active).length}
          hint="Recurring"
        />
      </div>

      {creating ? (
        <Panel title="New mission" className="mt-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="mission-name">
                Mission name
              </label>
              <input
                id="mission-name"
                className={inputClass}
                placeholder="Weekly progress — north tower"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="mission-project">
                Site
              </label>
              <select
                id="mission-project"
                className={inputClass}
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
                <option value="">Select a site…</option>
                {(projects.data ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="mission-type">
                Mission type
              </label>
              <select
                id="mission-type"
                className={inputClass}
                value={missionType}
                onChange={(event) => setMissionType(event.target.value as MissionType)}
              >
                {MISSION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {MISSION_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="mission-frequency">
                Repeat
              </label>
              <select
                id="mission-frequency"
                className={inputClass}
                value={frequency}
                onChange={(event) => setFrequency(event.target.value as ScheduleFrequency)}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            className={`${buttonClass} mt-3`}
            disabled={name.trim().length < 3 || !projectId || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Creating…" : "Create & plan"}
          </button>
        </Panel>
      ) : null}

      <Panel
        title="Missions"
        className="mt-3"
        dense
        action={
          <div className="flex gap-2">
            <select
              className="rounded-sm border border-border bg-input px-2 py-1 text-xs text-foreground"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              aria-label="Filter by site"
            >
              <option value="">All sites</option>
              {(projects.data ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-sm border border-border bg-input px-2 py-1 text-xs text-foreground"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              aria-label="Filter by mission type"
            >
              <option value="">All types</option>
              {MISSION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {MISSION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {missions.isPending ? (
          <LoadingPanel />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No missions"
            body="Create a mission template to plan waypoints, version changes and schedule weekly repeats."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-display text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-3 py-2">Mission</th>
                <th className="hidden px-3 py-2 md:table-cell">Site</th>
                <th className="px-3 py-2">Type</th>
                <th className="hidden px-3 py-2 lg:table-cell">Repeat</th>
                <th className="px-3 py-2 text-right">Version</th>
                <th className="px-3 py-2">Readiness</th>
                <th className="hidden px-3 py-2 lg:table-cell">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((mission) => (
                <tr key={mission.id} className="hover:bg-secondary/50">
                  <td className="px-3 py-2.5">
                    <Link
                      to="/missions/$missionId"
                      params={{ missionId: mission.id }}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {mission.name}
                    </Link>
                  </td>
                  <td className="hidden px-3 py-2.5 text-muted-foreground md:table-cell">
                    {projectName.get(mission.project_id) ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {MISSION_TYPE_LABELS[mission.mission_type]}
                  </td>
                  <td className="hidden px-3 py-2.5 text-muted-foreground lg:table-cell">
                    {FREQUENCY_LABELS[mission.repeat_frequency]}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">
                    v{mission.current_version}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusChip
                      label={mission.readiness_state}
                      tone={
                        mission.readiness_state === "READY"
                          ? "success"
                          : mission.readiness_state === "BLOCKED"
                            ? "danger"
                            : "warning"
                      }
                    />
                  </td>
                  <td className="hidden px-3 py-2.5 font-mono text-xs text-muted-foreground lg:table-cell">
                    {formatDate(mission.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Recurring schedules" className="mt-3" dense>
        {schedules.isPending ? (
          <LoadingPanel />
        ) : (schedules.data ?? []).length === 0 ? (
          <EmptyState title="No schedules" body="Open a mission and set a repeat frequency to build the flight queue." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-display text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-3 py-2">Mission</th>
                <th className="hidden px-3 py-2 md:table-cell">Site</th>
                <th className="px-3 py-2">Frequency</th>
                <th className="px-3 py-2">Next</th>
                <th className="px-3 py-2">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(schedules.data ?? []).map((schedule) => (
                <tr key={schedule.id} className="hover:bg-secondary/50">
                  <td className="px-3 py-2.5">
                    <Link
                      to="/missions/$missionId"
                      params={{ missionId: schedule.mission_id }}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {(schedule as { missions?: { name: string } | null }).missions?.name ?? "Mission"}
                    </Link>
                  </td>
                  <td className="hidden px-3 py-2.5 text-muted-foreground md:table-cell">
                    {(schedule as { projects?: { name: string } | null }).projects?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{FREQUENCY_LABELS[schedule.frequency]}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {formatDateTime(schedule.next_occurrence)}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusChip
                      label={schedule.is_active ? "Active" : "Paused"}
                      tone={schedule.is_active ? "success" : "neutral"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </AppShell>
  );
}
