"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { userMessage } from "@/lib/errors";
import type { FormState } from "@/lib/types";

const uuid = z.string().uuid();
const field = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

// Every check (role, membership, creator, current version, blockers) is enforced inside the database functions
// of migration 003, using the signed-in user's own identity. These actions only validate input and pass it on.
async function call(fn: string, args: Record<string, unknown>, submissionId: string, ok: string): Promise<FormState> {
  const s = await requireSession();
  const { error } = await s.supabase.rpc(fn, args);
  if (error) return { error: userMessage(error, "That did not work. Try again.") };
  revalidatePath(`/submissions/${submissionId}`);
  revalidatePath("/queue");
  revalidatePath("/dashboard");
  return { ok };
}

export async function requestApproval(_p: FormState, fd: FormData): Promise<FormState> {
  const id = uuid.safeParse(field(fd, "id"));
  if (!id.success) return { error: "Missing submission." };
  return call("request_approval", { p_submission: id.data }, id.data, "Sent to a reviewer.");
}

export async function decideFinding(_p: FormState, fd: FormData): Promise<FormState> {
  const sub = uuid.safeParse(field(fd, "id"));
  const finding = uuid.safeParse(field(fd, "finding_id"));
  const decision = z.enum(["disputed", "dismissed", "resolved", "overridden"]).safeParse(field(fd, "decision"));
  const reason = z.string().trim().min(5, "Give a reason of at least 5 characters.").max(1000).safeParse(field(fd, "reason"));
  if (!sub.success || !finding.success || !decision.success) return { error: "Invalid request." };
  if (!reason.success) return { error: reason.error.issues[0]?.message ?? "Give a reason." };
  return call("decide_finding", { p_finding: finding.data, p_decision: decision.data, p_reason: reason.data }, sub.data, "Decision recorded.");
}

export async function addComment(_p: FormState, fd: FormData): Promise<FormState> {
  const sub = uuid.safeParse(field(fd, "id"));
  const body = z.string().trim().min(1, "Write a comment.").max(2000).safeParse(field(fd, "body"));
  if (!sub.success) return { error: "Missing submission." };
  if (!body.success) return { error: body.error.issues[0]?.message ?? "Write a comment." };
  return call("add_comment", { p_submission: sub.data, p_finding: null, p_body: body.data }, sub.data, "Comment added.");
}

export async function reviewSubmission(_p: FormState, fd: FormData): Promise<FormState> {
  const sub = uuid.safeParse(field(fd, "id"));
  const ver = uuid.safeParse(field(fd, "version_id"));
  const decision = z.enum(["approved", "changes_requested"]).safeParse(field(fd, "decision"));
  const note = z.string().trim().max(1000).safeParse(field(fd, "note"));
  if (!sub.success || !ver.success || !decision.success || !note.success) return { error: "Invalid request." };
  return call("review_submission", { p_submission: sub.data, p_version: ver.data, p_decision: decision.data, p_note: note.data }, sub.data,
    decision.data === "approved" ? "Version approved." : "Changes requested.");
}
