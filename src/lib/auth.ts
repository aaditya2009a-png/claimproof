import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

/**
 * Verifies the session with Supabase Auth (getUser, not just the cookie) and loads the caller's
 * workspace membership. Every protected page and server action calls this first.
 * MVP: a user works in their oldest workspace membership.
 */
export const requireSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, display_name, workspaces(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);
  const m = rows?.[0];
  if (!m) redirect("/no-access");

  const ws: any = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
  return {
    supabase,
    userId: user.id as string,
    email: (user.email ?? "") as string,
    workspaceId: m.workspace_id as string,
    workspaceName: (ws?.name ?? "Workspace") as string,
    role: m.role as Role,
    displayName: (m.display_name || user.email || "") as string,
  };
});
