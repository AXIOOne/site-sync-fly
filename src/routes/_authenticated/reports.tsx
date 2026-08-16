import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, EmptyState, LoadingPanel, Panel, SectionLabel } from "@/components/app-shell";
import { StatusChip } from "@/components/status-chip";
import { flightsQuery, mediaQuery, projectsQuery, reportsQuery } from "@/lib/queries";
import { formatDateTime } from "@/lib/domain";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useWorkspace } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Progress Reports — Aerial Site Ops" },
      {
        name: "description",
        content:
          "Assemble weekly progress reports from a flight's captures, with notes for owners, project managers and subcontractors.",
      },
      { property: "og:title", content: "Progress Reports — Aerial Site Ops" },
      {
        property: "og:description",
        content: "Build weekly progress reports from flight captures and share them with the project team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { user } = useSession();
  const { data: workspace } = useWorkspace(user?.id);
  const queryClient = useQueryClient();
  const projects = useQuery(projectsQuery());
  const reports = useQuery(reportsQuery());

  const [projectId, setProjectId] = useState<string>("");
  const activeProject = projectId || projects.data?.[0]?.id || "";
  const flights = useQuery({ ...flightsQuery({ projectId: activeProject, limit: 40 }), enabled: Boolean(activeProject) });
  const [flightId, setFlightId] = useState<string>("");
  const media = useQuery({ ...mediaQuery({ flightId }), enabled: Boolean(flightId) });
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function createReport() {
    if (!workspace || !activeProject || !title.trim()) {
      toast.error("Add a title and pick a project first");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("reports").insert({
      organization_id: workspace.organization.id,
      project_id: activeProject,
      flight_id: flightId || null,
      title: title.trim(),
      report_type: "weekly_progress",
      notes: notes.trim() || null,
      selected_media_ids: selected,
      created_by: user?.id ?? null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Report created");
    setTitle("");
    setNotes("");
    setSelected([]);
    queryClient.invalidateQueries({ queryKey: ["reports"] });
  }

  return (
    <AppShell title="Progress Reports" subtitle="Package flight captures and notes into a shareable weekly report.">
      <div className="grid gap-3 xl:grid-cols-[1fr_1.2fr]">
        <Panel title="New report">
          <div className="space-y-3">
            <label className="block">
              <SectionLabel>Title</SectionLabel>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Week 14 progress — structural steel"
                className="mt-1 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
              />
            </label>
            <label className="block">
              <SectionLabel>Project</SectionLabel>
              <select
                value={activeProject}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setFlightId("");
                  setSelected([]);
                }}
                className="mt-1 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground"
              >
                {(projects.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <SectionLabel>Source flight</SectionLabel>
              <select
                value={flightId}
                onChange={(e) => {
                  setFlightId(e.target.value);
                  setSelected([]);
                }}
                className="mt-1 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value="">No specific flight</option>
                {(flights.data ?? []).map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {f.missions?.name} — {formatDateTime(f.started_at ?? f.scheduled_at)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <SectionLabel>Notes</SectionLabel>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Observations, deltas from last week, items for the owner."
                className="mt-1 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
              />
            </label>

            {flightId ? (
              <div>
                <SectionLabel>Select captures ({selected.length})</SectionLabel>
                <div className="mt-1 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto rounded-sm border border-border p-2">
                  {(media.data ?? []).map((m: any) => {
                    const on = selected.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          setSelected(on ? selected.filter((id) => id !== m.id) : [...selected, m.id])
                        }
                        className={
                          "overflow-hidden rounded-sm border " +
                          (on ? "border-primary" : "border-border opacity-70 hover:opacity-100")
                        }
                      >
                        <img
                          src={m.thumbnail_url ?? ""}
                          alt={`Capture at waypoint ${m.waypoint_sequence ?? "—"}`}
                          className="aspect-[4/3] w-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    );
                  })}
                  {(media.data ?? []).length === 0 ? (
                    <p className="col-span-3 py-4 text-center text-xs text-muted-foreground">
                      This flight has no captures.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              disabled={busy || !workspace?.canEdit}
              onClick={createReport}
              className="w-full rounded-sm bg-primary px-3 py-2.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Create report"}
            </button>
            {workspace && !workspace.canEdit ? (
              <p className="text-xs text-muted-foreground">Your role has read-only access.</p>
            ) : null}
          </div>
        </Panel>

        <Panel title="Reports" dense>
          {reports.isPending ? (
            <LoadingPanel />
          ) : (reports.data ?? []).length === 0 ? (
            <EmptyState title="No reports yet" body="Create a report to package captures and notes for the team." />
          ) : (
            <div className="divide-y divide-border">
              {(reports.data ?? []).map((r: any) => (
                <div key={r.id} className="px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{r.title}</p>
                    <StatusChip label={r.report_type.replace("_", " ")} tone="info" dot={false} />
                  </div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    {r.projects?.name} • {formatDateTime(r.created_at)} •{" "}
                    {(r.selected_media_ids ?? []).length} captures
                  </p>
                  {r.notes ? <p className="mt-1.5 text-sm text-muted-foreground">{r.notes}</p> : null}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
