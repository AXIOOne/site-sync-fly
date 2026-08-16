import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, EmptyState, LoadingPanel, Panel } from "@/components/app-shell";
import { StatusChip, toneForFlightStatus, toneForResult } from "@/components/status-chip";
import { assignmentsQuery, flightsQuery } from "@/lib/queries";
import {
  FLIGHT_RESULT_LABELS,
  FLIGHT_STATUS_LABELS,
  formatDateTime,
  formatDistanceMeters,
  formatDuration,
} from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/flights/")({
  head: () => ({
    meta: [
      { title: "Flights — SiteView Missions" },
      {
        name: "description",
        content:
          "Flight log and upcoming assignments: duration, distance, photos captured, completion percentage and mission results.",
      },
      { property: "og:title", content: "Flights — SiteView Missions" },
      {
        property: "og:description",
        content: "Flight log and upcoming assignments with duration, distance, capture counts and results.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FlightsIndex,
});

const TABS = [
  { key: "log", label: "Flight log" },
  { key: "queue", label: "Assignment queue" },
] as const;

function FlightsIndex() {
  const [tab, setTab] = useState<"log" | "queue">("log");
  const flights = useQuery(flightsQuery({ limit: 200 }));
  const assignments = useQuery(assignmentsQuery());

  return (
    <AppShell
      title="Flights"
      subtitle="Executed and simulated flights, plus the queue of assignments waiting on a pilot or the Flight Agent."
      actions={
        <div className="flex gap-1 rounded-sm border border-border p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                "rounded-sm px-2.5 py-1 font-display text-[11px] font-semibold uppercase tracking-[0.11em] transition-colors " +
                (tab === t.key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {tab === "log" ? (
        <Panel dense>
          {flights.isPending ? (
            <LoadingPanel />
          ) : (flights.data ?? []).length === 0 ? (
            <EmptyState title="No flights" body="Run or simulate a mission to create a flight record." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left font-display text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-3 py-2">Mission</th>
                  <th className="hidden px-3 py-2 md:table-cell">Project</th>
                  <th className="px-3 py-2">Started</th>
                  <th className="hidden px-3 py-2 lg:table-cell">Pilot / aircraft</th>
                  <th className="px-3 py-2 text-right">Duration</th>
                  <th className="hidden px-3 py-2 text-right lg:table-cell">Distance</th>
                  <th className="px-3 py-2 text-right">Photos</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(flights.data ?? []).map((f: any) => (
                  <tr key={f.id} className="hover:bg-secondary/50">
                    <td className="px-3 py-2.5">
                      <Link
                        to="/flights/$flightId"
                        params={{ flightId: f.id }}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {f.missions?.name ?? "Mission"}
                      </Link>
                      {f.is_simulated ? (
                        <StatusChip className="ml-2" label="Sim" tone="warning" dot={false} />
                      ) : null}
                    </td>
                    <td className="hidden px-3 py-2.5 text-muted-foreground md:table-cell">{f.projects?.name}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                      {formatDateTime(f.started_at ?? f.scheduled_at)}
                    </td>
                    <td className="hidden px-3 py-2.5 text-muted-foreground lg:table-cell">
                      {f.pilots?.full_name ?? "—"}
                      <span className="block font-mono text-[11px]">{f.drones?.model ?? "—"}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                      {formatDuration(f.duration_seconds)}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground lg:table-cell">
                      {formatDistanceMeters(f.distance_m == null ? null : Number(f.distance_m))}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                      {f.photos_captured}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        <StatusChip
                          label={FLIGHT_STATUS_LABELS[f.status as keyof typeof FLIGHT_STATUS_LABELS]}
                          tone={toneForFlightStatus(f.status)}
                        />
                        {f.result ? (
                          <StatusChip
                            label={FLIGHT_RESULT_LABELS[f.result as keyof typeof FLIGHT_RESULT_LABELS]}
                            tone={toneForResult(f.result)}
                            dot={false}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      ) : (
        <Panel dense>
          {assignments.isPending ? (
            <LoadingPanel />
          ) : (assignments.data ?? []).length === 0 ? (
            <EmptyState
              title="Queue empty"
              body="Assignments are created from a mission's repeat schedule or dispatched manually."
            />
          ) : (
            <div className="divide-y divide-border">
              {(assignments.data ?? []).map((a: any) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                  <div className="min-w-52 flex-1">
                    <p className="text-sm font-medium text-foreground">{a.missions?.name}</p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      {a.projects?.name} • {formatDateTime(a.scheduled_for)}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.pilots?.full_name ?? "Unassigned pilot"} • {a.drones?.model ?? "No aircraft"}
                  </div>
                  <StatusChip
                    label={FLIGHT_STATUS_LABELS[a.status as keyof typeof FLIGHT_STATUS_LABELS]}
                    tone={toneForFlightStatus(a.status)}
                  />
                  <StatusChip
                    label={a.dispatched_to_agent ? "Dispatched" : "Not dispatched"}
                    tone={a.dispatched_to_agent ? "info" : "neutral"}
                    dot={false}
                  />
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </AppShell>
  );
}
