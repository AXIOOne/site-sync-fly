import { Link, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useWorkspace } from "@/hooks/useSession";
import { ROLE_LABELS } from "@/lib/domain";
import { StatusChip } from "@/components/status-chip";
import { cn } from "@/lib/utils";
import siteviewLogo from "@/assets/siteview-logo.png.asset.json";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/projects", label: "Projects" },
  { to: "/missions", label: "Missions" },
  { to: "/flights", label: "Flights" },
  { to: "/media", label: "Media" },
  { to: "/progress", label: "Progress" },
  { to: "/reports", label: "Reports" },
  { to: "/fleet", label: "Fleet" },
  { to: "/pilots", label: "Pilots" },
  { to: "/integrations", label: "Integrations" },
  { to: "/settings", label: "Settings" },
] as const;


export function AppShell({
  children,
  title,
  subtitle,
  actions,
  fullBleed = false,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  fullBleed?: boolean;
}) {
  const { user } = useSession();
  const { data: workspace } = useWorkspace(user?.id);
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-panel/95 backdrop-blur">
        <div className="flex h-14 items-center gap-6 px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img
              src={siteviewLogo.url}
              alt="SiteView Missions"
              className="h-7 w-auto"
            />
          </Link>
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{ className: "bg-secondary text-foreground" }}
                className="rounded-sm px-2.5 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.11em] text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {workspace ? (
              <div className="hidden text-right sm:block">
                <p className="text-xs font-medium text-foreground">{workspace.profile.full_name ?? "Operator"}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  {workspace.roles.map((r) => ROLE_LABELS[r]).join(" • ") || "Viewer"}
                </p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                router.navigate({ to: "/auth" });
              }}
              className="rounded-sm border border-border px-2.5 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.11em] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-3 py-1.5 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{ className: "bg-secondary text-foreground" }}
              className="whitespace-nowrap rounded-sm px-2 py-1 font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {title ? (
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-panel/50 px-4 py-4">
          <div>
            <h1 className="font-display text-2xl font-bold uppercase tracking-[0.05em] text-foreground">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}

      <main className={cn("flex-1", fullBleed ? "" : "px-4 py-5")}>{children}</main>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  dense = false,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  dense?: boolean;
}) {
  return (
    <section className={cn("rounded-md border border-border bg-card", className)}>
      {title ? (
        <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </h2>
          {action}
        </header>
      ) : null}
      <div className={dense ? "" : "p-3"}>{children}</div>
    </section>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "success" | "warning" | "danger" | "info";
}) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2.5">
      <p className="font-display text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-mono text-xl font-semibold tabular-nums text-foreground",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-destructive",
          tone === "info" && "text-info",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-panel/40 px-6 py-12 text-center">
      <p className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-foreground">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  );
}

export function LoadingPanel({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-6 text-sm text-muted-foreground">
      <span className="size-2 animate-pulse rounded-full bg-primary" />
      {label}…
    </div>
  );
}

export { StatusChip };
