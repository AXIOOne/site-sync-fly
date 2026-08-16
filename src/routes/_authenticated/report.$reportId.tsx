import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingPanel } from "@/components/app-shell";
import { reportQuery } from "@/lib/queries";
import { formatDate, formatDateTime, formatDistanceMeters, formatDuration } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/report/$reportId")({
  head: () => ({
    meta: [
      { title: "Progress Report — SiteView Missions" },
      {
        name: "description",
        content:
          "Printable weekly construction progress report with flight statistics, annotated aerial captures and site notes.",
      },
      { property: "og:title", content: "Progress Report — SiteView Missions" },
      {
        property: "og:description",
        content: "Printable weekly drone progress report with flight statistics and aerial captures.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportView,
});

function ReportView() {
  const { reportId } = Route.useParams();
  const report = useQuery(reportQuery(reportId));

  const mediaIds = (report.data?.selected_media_ids ?? []) as string[];
  const media = useQuery({
    queryKey: ["report-media", reportId, mediaIds],
    enabled: mediaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media")
        .select("*")
        .in("id", mediaIds)
        .order("captured_at");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  if (report.isPending) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <LoadingPanel label="Loading report" />
      </div>
    );
  }

  const data = report.data;
  if (!data) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground">
        Report not found.{" "}
        <Link to="/reports" className="text-primary hover:underline">
          Back to reports
        </Link>
      </div>
    );
  }

  const project = (data as { projects?: { name: string; client: string | null; address: string | null; project_number: string | null; progress_percent: number } | null }).projects;
  const flight = (data as {
    flights?: {
      started_at: string | null;
      duration_seconds: number | null;
      distance_m: number | null;
      max_altitude_ft: number | null;
      photos_captured: number;
      missions?: { name: string } | null;
      pilots?: { full_name: string } | null;
      drones?: { manufacturer: string; model: string } | null;
    } | null;
  }).flights;

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <div className="mx-auto max-w-4xl px-6 py-8 print:px-0 print:py-0">
        <div className="flex items-center justify-between gap-3 print:hidden">
          <Link
            to="/reports"
            className="font-display text-[11px] font-semibold uppercase tracking-[0.11em] text-muted-foreground hover:text-foreground"
          >
            ← Reports
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-sm border border-primary/50 bg-primary/15 px-3 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.11em] text-primary hover:bg-primary/25"
          >
            Print / save PDF
          </button>
        </div>

        <header className="mt-6 border-b border-border pb-4">
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
            {data.report_type.replace(/_/g, " ")}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase leading-tight tracking-[0.02em] text-foreground">
            {data.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {project?.name ?? "Site"}
            {project?.project_number ? ` · ${project.project_number}` : ""}
            {project?.client ? ` · ${project.client}` : ""}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            Issued {formatDateTime(data.created_at)}
          </p>
        </header>

        <section className="mt-5 grid gap-3 sm:grid-cols-4">
          {[
            { label: "Site progress", value: `${project?.progress_percent ?? 0}%` },
            { label: "Flight date", value: formatDate(flight?.started_at ?? null) },
            { label: "Flight time", value: formatDuration(flight?.duration_seconds ?? null) },
            { label: "Captures", value: String(flight?.photos_captured ?? mediaIds.length) },
          ].map((item) => (
            <div key={item.label} className="rounded-md border border-border bg-card p-3">
              <p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1 font-display text-lg font-bold text-foreground">{item.value}</p>
            </div>
          ))}
        </section>

        {flight ? (
          <section className="mt-5 rounded-md border border-border bg-card p-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-foreground">
              Flight summary
            </h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Mission</dt>
                <dd className="text-foreground">{flight.missions?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Pilot in command</dt>
                <dd className="text-foreground">{flight.pilots?.full_name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Aircraft</dt>
                <dd className="text-foreground">
                  {flight.drones ? `${flight.drones.manufacturer} ${flight.drones.model}` : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Distance flown</dt>
                <dd className="text-foreground">{formatDistanceMeters(flight.distance_m)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Max altitude</dt>
                <dd className="text-foreground">
                  {flight.max_altitude_ft ? `${Math.round(Number(flight.max_altitude_ft))} ft AGL` : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Site address</dt>
                <dd className="text-foreground">{project?.address ?? "—"}</dd>
              </div>
            </dl>
          </section>
        ) : null}

        {data.notes ? (
          <section className="mt-5 rounded-md border border-border bg-card p-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-foreground">
              Field notes
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{data.notes}</p>
          </section>
        ) : null}

        <section className="mt-5">
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-foreground">
            Aerial documentation
          </h2>
          {media.isPending && mediaIds.length > 0 ? (
            <LoadingPanel label="Loading captures" />
          ) : (media.data ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No captures were attached to this report.</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(media.data ?? []).map((item) => (
                <figure key={item.id} className="overflow-hidden rounded-md border border-border bg-card">
                  <img
                    src={item.file_url ?? item.thumbnail_url ?? ""}
                    alt={`Aerial capture at waypoint ${item.waypoint_sequence ?? "n/a"} on ${formatDate(item.captured_at)}`}
                    className="aspect-[4/3] w-full object-cover"
                    loading="lazy"
                  />
                  <figcaption className="p-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    WP {item.waypoint_sequence ?? "—"} · {formatDateTime(item.captured_at)}
                    {item.altitude_ft ? ` · ${Math.round(Number(item.altitude_ft))} ft` : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-8 border-t border-border pt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          Generated by SiteView Missions · Part 107 operations record
        </footer>
      </div>
    </div>
  );
}
