"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { userMessage } from "@/lib/errors";
import { parseSourceForm } from "@/lib/validation";
import type { FormState } from "@/lib/types";

export async function saveSource(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  if (s.role !== "admin") return { error: "Only admins can change approved sources." };

  const parsed = parseSourceForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const { id, ...fields } = parsed.data;

  if (id) {
    const { data, error } = await s.supabase
      .from("approved_sources")
      .update(fields)
      .eq("id", id)
      .eq("workspace_id", s.workspaceId)
      .select("id");
    if (error) return { error: userMessage(error, "Could not save the source. Try again.") };
    if (!data || data.length === 0) return { error: "Source not found, or you do not have permission to edit it." };
  } else {
    const { error } = await s.supabase
      .from("approved_sources")
      .insert({ ...fields, workspace_id: s.workspaceId, created_by: s.userId });
    if (error) return { error: userMessage(error, "Could not add the source. Try again.") };
  }
  revalidatePath("/sources");
  return { ok: id ? "Source updated." : "Source added." };
}
