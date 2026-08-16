import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, EmptyState, LoadingPanel, Panel } from "@/components/app-shell";
import { StatusChip } from "@/components/status-chip";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useWorkspace } from "@/hooks/useSession";
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

const inputClass =
  "w-full rounded-sm border border-border bg-input px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary";
const labelClass = "font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";
const buttonClass =
  "rounded-sm border border-primary/50 bg-primary/15 px-3 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.11em] text-primary transition-colors hover:bg-primary/25 disabled:opacity-50";

const EMPTY_SITE = {
  name: "",
  project_number: "",
  client: "",
  address: "",
  latitude: "",
  longitude: "",
  project_manager: "",
  superintendent: "",
  start_date: "",
  estimated_completion: "",
};

function ProjectsIndex() {
  const projects = useQuery(projectsQuery());
  const missions = useQuery(missionsQuery());
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: workspace } = useWorkspace(user?.id);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_SITE);

  const missionCount = (projectId: string) =>
    (missions.data ?? []).filter((m) => m.project_id === projectId).length;

  const create = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error("Workspace not ready");
      const { error } = await supabase.from("projects").insert({
        organization_id: workspace.organization.id,
        name: form.name.trim(),
        project_number: form.project_number.trim() || null,
        client: form.client.trim() || null,
        address: form.address.trim() || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        project_manager: form.project_manager.trim() || null,
        superintendent: form.superintendent.trim() || null,
        start_date: form.start_date || null,
        estimated_completion: form.estimated_completion || null,
        status: "planning",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Site enrolled — draw boundaries and plan a mission next");
      setForm(EMPTY_SITE);
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Projects"
      subtitle="Construction sites enrolled in the drone program."
      actions={
        <button type="button" className={buttonClass} onClick={() => setOpen((value) => !value)}>
          {open ? "Close" : "Enroll site"}
        </button>
      }
    >
      {open ? (
        <Panel title="Enroll a construction site" className="mb-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor="s-name">
                Site name
              </label>
              <input
                id="s-name"
                className={inputClass}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="s-number">
                Project number
              </label>
              <input
                id="s-number"
                className={inputClass}
                value={form.project_number}
                onChange={(event) => setForm({ ...form, project_number: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="s-client">
                Client
              </label>
              <input
                id="s-client"
                className={inputClass}
                value={form.client}
                onChange={(event) => setForm({ ...form, client: event.target.value })}
              />
            </div>
            <div className="xl:col-span-2">
              <label className={labelClass} htmlFor="s-address">
                Address
              </label>
              <input
                id="s-address"
                className={inputClass}
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass} htmlFor="s-lat">
                  Latitude
                </label>
                <input
                  id="s-lat"
                  className={inputClass}
                  inputMode="decimal"
                  value={form.latitude}
                  onChange={(event) => setForm({ ...form, latitude: event.target.value })}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="s-lng">
                  Longitude
                </label>
                <input
                  id="s-lng"
                  className={inputClass}
                  inputMode="decimal"
                  value={form.longitude}
                  onChange={(event) => setForm({ ...form, longitude: event.target.value })}
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="s-pm">
                Project manager
              </label>
              <input
                id="s-pm"
                className={inputClass}
                value={form.project_manager}
                onChange={(event) => setForm({ ...form, project_manager: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="s-super">
                Superintendent
              </label>
              <input
                id="s-super"
                className={inputClass}
                value={form.superintendent}
                onChange={(event) => setForm({ ...form, superintendent: event.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass} htmlFor="s-start">
                  Start
                </label>
                <input
                  id="s-start"
                  type="date"
                  className={inputClass}
                  value={form.start_date}
                  onChange={(event) => setForm({ ...form, start_date: event.target.value })}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="s-end">
                  Target completion
                </label>
                <input
                  id="s-end"
                  type="date"
                  className={inputClass}
                  value={form.estimated_completion}
                  onChange={(event) => setForm({ ...form, estimated_completion: event.target.value })}
                />
              </div>
            </div>
          </div>
          <button
            type="button"
            className={`${buttonClass} mt-3`}
            disabled={form.name.trim().length < 3 || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Enrolling…" : "Enroll site"}
          </button>
        </Panel>
      ) : null}

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
