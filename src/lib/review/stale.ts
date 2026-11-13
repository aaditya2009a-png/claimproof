import type { SupabaseClient } from "@supabase/supabase-js";

export async function syncExpiredSourceAlerts(
  supabase: SupabaseClient,
  workspaceId: string
) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: expiredSources } = await supabase
    .from("approved_sources")
    .select("id")
    .eq("workspace_id", workspaceId)
    .lt("expiry_date", today);

  if (!expiredSources?.length) return;
  const expiredIds = expiredSources.map((s) => s.id);

  const { data: affected } = await supabase
    .from("submissions")
    .select(`
      id, needs_recheck,
      review_runs!inner(version_number, review_findings!inner(source_id))
    `)
    .eq("workspace_id", workspaceId)
    .eq("status", "approved")
    .eq("needs_recheck", false)
    .in("review_runs.review_findings.source_id", expiredIds);

  for (const sub of affected ?? []) {
    await supabase
      .from("submissions")
      .update({
        needs_recheck: true,
        recheck_reason: "Relies on an approved source that has passed its expiry date.",
      })
      .eq("id", sub.id);
  }
}
