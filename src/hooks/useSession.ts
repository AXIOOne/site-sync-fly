import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, Organization, Profile } from "@/lib/session-types";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export interface WorkspaceContext {
  profile: Profile;
  organization: Organization;
  roles: AppRole[];
  canEdit: boolean;
}

export function useWorkspace(userId: string | undefined) {
  return useQuery({
    queryKey: ["workspace", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<WorkspaceContext | null> => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      if (!profile) return null;
      const [{ data: org }, { data: roleRows }] = await Promise.all([
        supabase.from("organizations").select("*").eq("id", profile.organization_id).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
      ]);
      const roles = (roleRows ?? []).map((r) => r.role);
      return {
        profile,
        organization: org!,
        roles,
        canEdit: roles.some((r) => r !== "viewer"),
      };
    },
  });
}
