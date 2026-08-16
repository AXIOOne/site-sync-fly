import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, LoadingPanel, Panel } from "@/components/app-shell";
import { StatusChip } from "@/components/status-chip";
import { projectsQuery, missionsQuery } from "@/lib/queries";
import { formatDate } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({
    meta: [
      { title: "Projects — Aerial Site Ops" },
      {
        name: "description",
        content:
          "Every construction site in the drone program with progress, schedule dates, mission counts and project team assignments.",
      },
      { property: "og:title", content: "Projects — Aerial Site Ops" },
      {
        property: "og:description",
        content: "Construction sites in the drone program with progress, missions and team assignments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectsIndex,
});

function ProjectsIndex() {
  const projects = useQuery(projectsQuery());
  const missions = useQuery(missionsQuery());

  const missionCount = (projectId: string) =>
    (missions.data ?? []).filter((m) => m.project_id === projectId).length;

  return (
    <AppShell title="Projects" subtitle="Construction sites enrolled in the drone program.">
      <Panel dense>
        {projects.isPending ? (
          <LoadingPanel />
        ) : (projects.data ?? []).length === 0 ? (
          <EmptyState title="No projects" body="Projects hold site boundaries, missions and flight history." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-display text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-3 py-2">Project</th>
                <th className="px-3 py-2">Client</th>
                <th className="hidden px-3 py-2 md:table-cell">Manager</th>
                <th className="hidden px-3 py-2 lg:table-cell">Target completion</th>
                <th className="px-3 py-2">Missions</th>
                <th className="px-3 py-2">Progress</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(projects.data ?? []).map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-secondary/50">
                  <td className="px-3 py-2.5">
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: p.id }}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {p.name}
                    </Link>
                    <p className="font-mono text-[11px] text-muted-foreground">{p.project_number ?? "—"}</p>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.client ?? "—"}</td>
                  <td className="hidden px-3 py-2.5 text-muted-foreground md:table-cell">
                    {p.project_manager ?? "—"}
                  </td>
                  <td className="hidden px-3 py-2.5 font-mono text-xs text-muted-foreground lg:table-cell">
                    {formatDate(p.estimated_completion)}
                  </td>
                  <td className="px-3 py-2.5 font-mono tabular-nums text-muted-foreground">{missionCount(p.id)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full bg-primary" style={{ width: `${p.progress_percent}%` }} />
                      </div>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {p.progress_percent}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusChip
                      label={p.status}
                      tone={p.status === "active" ? "success" : p.status === "on_hold" ? "warning" : "neutral"}
                      dot={false}
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
