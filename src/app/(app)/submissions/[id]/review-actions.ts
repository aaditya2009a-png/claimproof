"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { userMessage } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { callModelName } from "@/lib/review/model";
import { ReviewError } from "@/lib/review/gemini";
import { reviewErrorMessage } from "@/lib/review/messages";
import { reviewDraft } from "@/lib/review/run";
import { retrieveSources } from "@/lib/review/sources";
import type { FormState } from "@/lib/types";

export async function runReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireSession();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Missing submission." };
  if (s.role === "reviewer") return { error: "Reviewers cannot run creator reviews." };
  if (!process.env.GEMINI_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: reviewErrorMessage("not_configured") };
  }

  const { data: sub } = await s.supabase
    .from("submissions").select("id, creator_id, current_version_id")
    .eq("id", id.data).eq("workspace_id", s.workspaceId).maybeSingle();
  if (!sub) return { error: "Submission not found." };
  if (sub.creator_id !== s.userId) return { error: "Only the creator can run a review." };
  const { data: ver } = await s.supabase
    .from("submission_versions").select("id, content").eq("id", sub.current_version_id).maybeSingle();
  if (!ver) return { error: "Draft version not found." };

  const { sources, coverage } = await retrieveSources(s.supabase, s.workspaceId);
  if (!sources.some((x) => !x.expired)) {
    return { error: "There are no approved, in-date sources to review against. Ask an admin to add or approve sources." };
  }

  const admin = createAdminClient();
  const started = await admin.rpc("start_review_run", {
    p_actor: s.userId, p_submission: sub.id, p_version: ver.id,
    p_model: callModelName(), p_sources: sources, p_coverage: coverage,
  });
  if (started.error || !started.data) return { error: userMessage(started.error, "Could not start the review. Try again.") };
  const runId = started.data as string;

  let code: string | null = null;
  let findings: unknown[] = [];
  try {
    findings = await reviewDraft(ver.content, sources);
  } catch (e) {
    code = e instanceof ReviewError ? e.code : "unexpected";
  }

  const saved = await admin.rpc("record_review_result", {
    p_actor: s.userId, p_run: runId, p_status: code ? "failed" : "succeeded",
    p_findings: code ? [] : findings, p_error_code: code,
  });
  revalidatePath(`/submissions/${sub.id}`);
  if (saved.error) return { error: "The review ran but could not be saved. Press Retry." };
  if (code) return { error: reviewErrorMessage(code) };
  return { ok: "Review complete." };
}
