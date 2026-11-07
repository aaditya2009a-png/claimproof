import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { StatusBadge, Badge } from "@/components/badge";
import { STATUS_LABELS, fmtDateTime } from "@/lib/format";
import { DraftForm } from "../draft-form";
import { ReviewPanel } from "./review-panel";
import { RunReviewForm } from "./run-review-form";
import { CommentForm, RequestApprovalForm, ReviewerForm } from "./workflow-forms";

export const maxDuration = 60; // the AI review runs inside this route's server action

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const s = await requireSession();

  const { data: sub, error } = await s.supabase
    .from("submissions").select("*").eq("id", id).eq("workspace_id", s.workspaceId).maybeSingle();
  if (error) throw new Error("submission query failed");
  if (!sub) notFound();

  const [versions, members] = await Promise.all([
    s.supabase.from("submission_versions")
      .select("id, version_number, content, content_hash, created_at")
      .eq("submission_id", id).order("version_number", { ascending: false }),
    s.supabase.from("workspace_members").select("user_id, display_name").eq("workspace_id", s.workspaceId),
  ]);
  if (versions.error || members.error) throw new Error("submission query failed");

  const current = (versions.data ?? []).find((v: any) => v.id === sub.current_version_id);
  if (!current) throw new Error("current version missing");
  const older = (versions.data ?? []).filter((v: any) => v.id !== current.id);
  const names: Record<string, string> = Object.fromEntries((members.data ?? []).map((m: any) => [m.user_id, m.display_name || "Unknown"]));
  const isCreator = s.userId === sub.creator_id;
  const canReview = isCreator && s.role !== "reviewer" && !["in_review", "approved"].includes(sub.status);
  const isReviewer = !isCreator && ["reviewer", "admin"].includes(s.role);

  // Latest review of the CURRENT version only; older versions keep their own runs.
  const { data: runs } = await s.supabase
    .from("review_runs")
    .select("id, status, model, source_coverage, sources_snapshot, error_code, started_at, completed_at")
    .eq("submission_version_id", current.id).order("started_at", { ascending: false }).limit(1);
  const run = runs?.[0];
  const { data: findings } = run?.status === "succeeded"
    ? await s.supabase.from("findings").select("*").eq("review_run_id", run.id).order("created_at")
    : { data: [] as any[] };
  const findingIds = (findings ?? []).map((f: any) => f.id);
  const [{ data: decisions }, { data: comments }, { data: approvals }] = await Promise.all([
    findingIds.length
      ? s.supabase.from("finding_decisions").select("*").in("finding_id", findingIds).order("created_at")
      : Promise.resolve({ data: [] as any[] }),
    s.supabase.from("comments").select("id, author_id, body, created_at, submission_version_id").eq("submission_id", id).order("created_at"),
    s.supabase.from("approvals").select("id, decision, note, reviewer_id, created_at, submission_version_id").eq("submission_id", id).order("created_at", { ascending: false }),
  ]);
  const lastForCurrent = (approvals ?? []).find((a: any) => a.submission_version_id === current.id);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="page-title">{sub.title}</h1>
          <StatusBadge status={sub.status} label={STATUS_LABELS[sub.status] ?? sub.status} />
        </div>
        <p className="mt-1 text-sm text-slate-600">
          By {names[sub.creator_id] ?? "Unknown"} · version {current.version_number} · saved {fmtDateTime(current.created_at)} · hash{" "}
          <code className="rounded bg-slate-100 px-1">{current.content_hash.slice(0, 12)}</code>
        </p>
        <Link href={`/submissions/${id}/passport`} className="mt-2 inline-block text-sm font-medium text-teal-700 hover:underline">
          View Evidence Passport (review record)
        </Link>
      </div>

      <section className="card">
        {isCreator ? (
          <DraftForm submissionId={sub.id} initialTitle={sub.title} initialContent={current.content} />
        ) : (
          <>
            <h2 className="mb-2 font-semibold">Current draft</h2>
            <pre className="whitespace-pre-wrap text-sm">{current.content}</pre>
            <p className="mt-3 text-xs text-slate-500">Only the creator can edit this submission.</p>
          </>
        )}
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="font-semibold">AI review</h2>
          <p className="mt-1 text-xs text-slate-500">
            Reviews the saved version (v{current.version_number}). Save your edits first. Running a review sends this
            draft’s text and your approved sources’ text to Google’s Gemini API. AI output can be wrong; a human
            reviewer makes the final decision.
          </p>
        </div>
        {canReview ? (
          <RunReviewForm submissionId={sub.id} retry={run?.status === "failed"} />
        ) : (
          <p className="text-sm text-slate-600">
            {isCreator ? "Edit the draft to create a new version before running another review." : "Only the creator can run a review."}
          </p>
        )}
        {run ? (
          <ReviewPanel
            run={run} findings={findings ?? []} decisions={decisions ?? []} names={names}
            viewer={{ userId: s.userId, role: s.role, isCreator, status: sub.status, submissionId: sub.id }}
          />
        ) : (
          <p className="text-sm text-slate-600">This version has not been reviewed yet.</p>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Approval</h2>
        {sub.status === "approved" && lastForCurrent && (
          <p className="text-sm">Approved by {names[lastForCurrent.reviewer_id] ?? "Unknown"} on {fmtDateTime(lastForCurrent.created_at)}. Editing the draft creates a new version that needs a new approval.</p>
        )}
        {sub.status === "changes_requested" && lastForCurrent && (
          <p className="text-sm">Changes requested by {names[lastForCurrent.reviewer_id] ?? "Unknown"}{lastForCurrent.note ? `: ${lastForCurrent.note}` : "."} Edit the draft, review it again, then request approval.</p>
        )}
        {isCreator && sub.status === "analyzed" && <RequestApprovalForm submissionId={sub.id} />}
        {isCreator && ["draft", "changes_requested"].includes(sub.status) && (
          <p className="text-sm text-slate-600">Run a successful AI review of this version before requesting approval.</p>
        )}
        {isCreator && sub.status === "in_review" && <p className="text-sm text-slate-600">Waiting for a reviewer.</p>}
        {isReviewer && sub.status === "in_review" && (
          <>
            <p className="text-sm text-slate-600">Blocking issues must be resolved or overridden (with a reason) before you can approve.</p>
            <ReviewerForm submissionId={sub.id} versionId={current.id} />
          </>
        )}
        {isReviewer && sub.status !== "in_review" && sub.status !== "approved" && <p className="text-sm text-slate-600">Not awaiting review yet.</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Comments</h2>
        {(comments ?? []).length === 0 && <p className="text-sm text-slate-600">No comments yet.</p>}
        <ul className="space-y-2">
          {(comments ?? []).map((c: any) => (
            <li key={c.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
              <span className="font-medium">{names[c.author_id] ?? "Unknown"}</span>{" "}
              <span className="text-xs text-slate-500">{fmtDateTime(c.created_at)}</span>
              <div className="mt-1 whitespace-pre-wrap">{c.body}</div>
            </li>
          ))}
        </ul>
        <CommentForm submissionId={sub.id} />
      </section>

      <section className="card">
        <h2 className="font-semibold">Version history</h2>
        <p className="mt-1 text-sm text-slate-600">Saved versions never change. Editing creates a new version.</p>
        <ul className="mt-3 space-y-2">
          <li className="flex items-center gap-2 text-sm">
            <Badge tone="teal">Current</Badge> v{current.version_number} · {fmtDateTime(current.created_at)}
          </li>
          {older.map((v: any) => (
            <li key={v.id} className="text-sm">
              <details>
                <summary className="cursor-pointer">
                  v{v.version_number} · {fmtDateTime(v.created_at)} · <code>{v.content_hash.slice(0, 12)}</code>
                  {(approvals ?? []).some((a: any) => a.submission_version_id === v.id && a.decision === "approved") ? " · was approved" : ""}
                </summary>
                <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-3">{v.content}</pre>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
