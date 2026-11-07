"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { userMessage } from "@/lib/errors";
import { parseSubmissionForm } from "@/lib/validation";
import type { FormState } from "@/lib/types";

// Authorisation is enforced again inside the database functions (see migration 001).
export async function createSubmission(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  if (s.role === "reviewer") return { error: "Reviewers cannot create submissions." };
  const parsed = parseSubmissionForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  const { data, error } = await s.supabase.rpc("create_submission", {
    p_workspace: s.workspaceId,
    p_title: parsed.data.title,
    p_content: parsed.data.content,
  });
  if (error || !data) return { error: userMessage(error, "Could not save the draft. Try again.") };
  redirect(`/submissions/${data}`);
}

export async function saveDraft(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  const parsed = parseSubmissionForm(formData);
  if (!parsed.success || !parsed.data.id) return { error: parsed.success ? "Missing submission." : (parsed.error.issues[0]?.message ?? "Check the form.") };

  const { error } = await s.supabase.rpc("save_new_version", {
    p_submission: parsed.data.id,
    p_title: parsed.data.title,
    p_content: parsed.data.content,
  });
  if (error) return { error: userMessage(error, "Could not save the draft. Try again.") };
  revalidatePath(`/submissions/${parsed.data.id}`);
  return { ok: "Draft saved. Changed text is stored as a new version." };
}
