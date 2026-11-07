import type { SupabaseClient } from "@supabase/supabase-js";
import { sourceStatus } from "@/lib/source-status";
import type { Coverage, ProvidedSource } from "./schema";

/**
 * MVP source retrieval: loads the workspace's approved sources and sends as many as fit in a character budget.
 * Deliberately simple and replaceable: to add pgvector later, replace the body of this one function so it
 * returns the most relevant sources for the draft, keeping the same return shape.
 */
export async function retrieveSources(
  sb: SupabaseClient,
  workspaceId: string,
  budget: number = Number(process.env.REVIEW_CONTEXT_CHAR_BUDGET) || 24000,
): Promise<{ sources: ProvidedSource[]; coverage: Coverage }> {
  const { data, error } = await sb
    .from("approved_sources")
    .select("id, title, content, type, version, effective_date, expiry_date")
    .eq("workspace_id", workspaceId)
    .eq("approved", true)
    .order("type")
    .order("title");
  if (error) throw new Error("sources query failed");

  const rows = data ?? [];
  const current: ProvidedSource[] = [];
  const expired: ProvidedSource[] = [];
  let notYet = 0;
  for (const r of rows) {
    const st = sourceStatus(r);
    const base = { id: r.id, version: r.version, type: r.type, title: r.title, content: r.content, effective_date: r.effective_date, expiry_date: r.expiry_date };
    if (st === "not_yet_effective") notYet++;
    else if (st === "expired") expired.push({ ...base, expired: true });
    else current.push({ ...base, expired: false });
  }

  const picked: ProvidedSource[] = [];
  let used = 0;
  let omitted = 0;
  for (const s of [...current, ...expired]) {
    if (used + s.content.length <= budget) {
      picked.push(s);
      used += s.content.length;
    } else omitted++;
  }

  return {
    sources: picked,
    coverage: {
      total_approved: rows.length,
      active_used: picked.filter((s) => !s.expired).length,
      expired_used: picked.filter((s) => s.expired).length,
      not_yet_effective_skipped: notYet,
      omitted_for_budget: omitted,
      chars_used: used,
      char_budget: budget,
      warning: omitted > 0 ? `${omitted} approved source(s) did not fit in the review budget and were NOT checked.` : null,
    },
  };
}
