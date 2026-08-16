import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import siteviewLogo from "@/assets/siteview-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SiteView Missions" },
      {
        name: "description",
        content:
          "Sign in to SiteView Missions to plan repeatable construction drone missions, review flights and compare site progress.",
      },
      { property: "og:title", content: "Sign in — SiteView Missions" },
      {
        property: "og:description",
        content: "Access your construction drone mission workspace: planning, flight records and progress comparison.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        toast.success("Account created", { description: "You've been added to the demo workspace." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-panel p-10 lg:flex">
        <img
          src="/demo/site-late.jpg"
          alt="Aerial view of an active construction site"
          className="absolute inset-0 size-full object-cover opacity-30"
        />
        <div className="relative">
          <img src={siteviewLogo.url} alt="SiteView Missions" className="h-8 w-auto" />
          <h1 className="mt-6 max-w-lg font-display text-4xl font-bold uppercase leading-[1.05] tracking-[0.02em] text-foreground">
            Repeatable drone missions for construction progress
          </h1>
          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            Plan waypoint missions on satellite imagery, version every change, schedule weekly repeats, and compare the
            same viewpoint week over week.
          </p>
        </div>
        <ul className="relative space-y-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          <li>— Mission planner with immutable versioning</li>
          <li>— Flight records, telemetry and event logs</li>
          <li>— Mission packages ready for a DJI Flight Agent</li>
        </ul>
      </div>

      <div className="flex items-center justify-center px-6 py-14">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-bold uppercase tracking-[0.05em] text-foreground">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New accounts join the shared demo workspace as an administrator.
          </p>

          <button
            type="button"
            onClick={google}
            disabled={busy}
            className="mt-6 w-full rounded-sm border border-border bg-card px-3 py-2.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
          >
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">or email</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" ? (
              <Field label="Full name" value={fullName} onChange={setFullName} type="text" required />
            ) : null}
            <Field label="Email" value={email} onChange={setEmail} type="email" required />
            <Field label="Password" value={password} onChange={setPassword} type="password" required />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-sm bg-primary px-3 py-2.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-display text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
      />
    </label>
  );
}
