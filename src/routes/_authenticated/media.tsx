import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, EmptyState, LoadingPanel, Panel, SectionLabel } from "@/components/app-shell";
import { StatusChip } from "@/components/status-chip";
import { mediaQuery, projectsQuery } from "@/lib/queries";
import { formatDateTime } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/media")({
  validateSearch: (search: Record<string, unknown>) => ({
    projectId: typeof search["projectId"] === "string" ? (search["projectId"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Media & Progress Comparison — Aerial Site Ops" },
      {
        name: "description",
        content:
          "Geotagged capture library with a side-by-side progress comparison of the same waypoint across different flight dates.",
      },
      { property: "og:title", content: "Media & Progress Comparison — Aerial Site Ops" },
      {
        property: "og:description",
        content: "Compare the same viewpoint across flight dates and browse every geotagged capture.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MediaPage,
});

function MediaPage() {
  const search = Route.useSearch();
  const projects = useQuery(projectsQuery());
  const [projectId, setProjectId] = useState<string | undefined>(search.projectId);
  const activeProject = projectId ?? projects.data?.[0]?.id;
  const media = useQuery({
    ...mediaQuery(activeProject ? { projectId: activeProject } : {}),
    enabled: Boolean(activeProject),
  });

  const items = (media.data ?? []) as any[];

  /** Waypoint sequences that were captured on more than one date → comparable viewpoints. */
  const viewpoints = useMemo(() => {
    const map = new Map<number, any[]>();
    for (const item of items) {
      if (item.waypoint_sequence == null) continue;
      const list = map.get(item.waypoint_sequence) ?? [];
      list.push(item);
      map.set(item.waypoint_sequence, list);
    }
    return [...map.entries()]
      .map(([sequence, list]) => ({
        sequence,
        captures: list.slice().sort((a, b) => (a.captured_at ?? "").localeCompare(b.captured_at ?? "")),
      }))
      .filter((v) => v.captures.length > 1)
      .sort((a, b) => a.sequence - b.sequence);
  }, [items]);

  const [selectedSequence, setSelectedSequence] = useState<number | null>(null);
  const viewpoint = viewpoints.find((v) => v.sequence === (selectedSequence ?? viewpoints[0]?.sequence));
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState<number | null>(null);
  const left = viewpoint?.captures[Math.min(leftIdx, viewpoint.captures.length - 1)];
  const right = viewpoint?.captures[rightIdx ?? viewpoint.captures.length - 1];

  return (
    <AppShell
      title="Media & Progress"
      subtitle="Every capture is geotagged to a waypoint, so the same viewpoint can be compared across weeks."
      actions={
        <select
          value={activeProject ?? ""}
          onChange={(e) => {
            setProjectId(e.target.value);
            setSelectedSequence(null);
          }}
          className="rounded-sm border border-input bg-card px-2.5 py-1.5 text-xs text-foreground"
        >
          {(projects.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      }
    >
      {media.isPending ? (
        <LoadingPanel />
      ) : items.length === 0 ? (
        <EmptyState
          title="No media"
          body="Captures appear here after a flight uploads photos, or after a simulated flight registers its captures."
        />
      ) : (
        <>
          <Panel title="Progress comparison" dense>
            {!viewpoint ? (
              <p className="px-3 py-6 text-sm text-muted-foreground">
                Comparison needs the same waypoint captured on at least two dates. Fly a repeatable mission again to
                unlock it.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2">
                  <SectionLabel>Viewpoint</SectionLabel>
                  {viewpoints.map((v) => (
                    <button
                      key={v.sequence}
                      type="button"
                      onClick={() => {
                        setSelectedSequence(v.sequence);
                        setLeftIdx(0);
                        setRightIdx(null);
                      }}
                      className={
                        "rounded-sm border px-2 py-0.5 font-mono text-[11px] " +
                        (viewpoint.sequence === v.sequence
                          ? "border-primary/60 bg-primary/15 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground")
                      }
                    >
                      WP {String(v.sequence).padStart(2, "0")} · {v.captures.length}
                    </button>
                  ))}
                </div>
                <div className="grid gap-3 p-3 md:grid-cols-2">
                  <ComparePane
                    label="Earlier"
                    captures={viewpoint.captures}
                    index={Math.min(leftIdx, viewpoint.captures.length - 1)}
                    onIndex={setLeftIdx}
                    capture={left}
                  />
                  <ComparePane
                    label="Later"
                    captures={viewpoint.captures}
                    index={rightIdx ?? viewpoint.captures.length - 1}
                    onIndex={(i) => setRightIdx(i)}
                    capture={right}
                  />
                </div>
              </>
            )}
          </Panel>

          <Panel title={`Capture library — ${items.length} items`} className="mt-3" dense>
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-5">
              {items.map((m) => (
                <figure key={m.id} className="overflow-hidden rounded-md border border-border bg-panel/50">
                  {m.thumbnail_url ? (
                    <img
                      src={m.thumbnail_url}
                      alt={`Capture at waypoint ${m.waypoint_sequence ?? "—"} on ${formatDateTime(m.captured_at)}`}
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-[4/3] w-full bg-secondary" />
                  )}
                  <figcaption className="space-y-0.5 px-2 py-1.5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      WP {m.waypoint_sequence ?? "—"} • {m.media_type}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">{formatDateTime(m.captured_at)}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </Panel>
        </>
      )}
    </AppShell>
  );
}

function ComparePane({
  label,
  captures,
  index,
  onIndex,
  capture,
}: {
  label: string;
  captures: any[];
  index: number;
  onIndex: (i: number) => void;
  capture: any;
}) {
  return (
    <div className="rounded-md border border-border bg-panel/50">
      <div className="flex items-center justify-between gap-2 border-b border-border px-2.5 py-1.5">
        <SectionLabel>{label}</SectionLabel>
        <select
          value={index}
          onChange={(e) => onIndex(Number(e.target.value))}
          className="rounded-sm border border-input bg-card px-2 py-1 font-mono text-[11px] text-foreground"
        >
          {captures.map((c, i) => (
            <option key={c.id} value={i}>
              {formatDateTime(c.captured_at)}
            </option>
          ))}
        </select>
      </div>
      {capture?.file_url ? (
        <img
          src={capture.file_url}
          alt={`${label} capture at waypoint ${capture.waypoint_sequence} on ${formatDateTime(capture.captured_at)}`}
          className="aspect-[4/3] w-full object-cover"
        />
      ) : (
        <div className="aspect-[4/3] w-full bg-secondary" />
      )}
      <div className="flex flex-wrap items-center gap-2 px-2.5 py-2">
        <StatusChip label={capture?.aircraft ?? "Aircraft n/a"} tone="neutral" dot={false} />
        <span className="font-mono text-[11px] text-muted-foreground">
          {capture?.altitude_ft ? `${Number(capture.altitude_ft)} ft` : "—"} · gimbal{" "}
          {capture?.gimbal_pitch != null ? `${Number(capture.gimbal_pitch)}°` : "—"}
        </span>
      </div>
    </div>
  );
}
