"use client";
import { ActionForm } from "@/components/action-form";
import { FormMessage } from "@/components/form-message";
import { addComment, decideFinding, requestApproval, reviewSubmission } from "./workflow-actions";

export function RequestApprovalForm({ submissionId }: { submissionId: string }) {
  return (
    <ActionForm action={requestApproval} className="space-y-3">
      {({ state, pending }) => (
        <>
          <input type="hidden" name="id" value={submissionId} />
          <FormMessage state={state} />
          <button type="submit" disabled={pending} className="btn-primary">{pending ? "Sending…" : "Request reviewer approval"}</button>
        </>
      )}
    </ActionForm>
  );
}

export function DecisionForm({ submissionId, findingId, options }: { submissionId: string; findingId: string; options: { value: string; label: string }[] }) {
  return (
    <ActionForm action={decideFinding} className="space-y-2 border-t border-slate-100 pt-3">
      {({ state, pending }) => (
        <>
          <input type="hidden" name="id" value={submissionId} />
          <input type="hidden" name="finding_id" value={findingId} />
          <div className="flex flex-wrap gap-2">
            <select name="decision" className="input w-auto" aria-label="Decision">
              {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input name="reason" required minLength={5} maxLength={1000} placeholder="Reason (required)" className="input min-w-[12rem] flex-1" aria-label="Reason" />
            <button type="submit" disabled={pending} className="btn-secondary">{pending ? "Saving…" : "Save"}</button>
          </div>
          <FormMessage state={state} />
        </>
      )}
    </ActionForm>
  );
}

export function CommentForm({ submissionId }: { submissionId: string }) {
  return (
    <ActionForm action={addComment} className="space-y-2">
      {({ state, pending }) => (
        <>
          <input type="hidden" name="id" value={submissionId} />
          <textarea name="body" required maxLength={2000} rows={2} placeholder="Add a comment" className="input" aria-label="Comment" />
          <FormMessage state={state} />
          <button type="submit" disabled={pending} className="btn-secondary">{pending ? "Posting…" : "Post comment"}</button>
        </>
      )}
    </ActionForm>
  );
}

export function ReviewerForm({ submissionId, versionId }: { submissionId: string; versionId: string }) {
  return (
    <ActionForm action={reviewSubmission} className="space-y-3">
      {({ state, pending }) => (
        <>
          <input type="hidden" name="id" value={submissionId} />
          <input type="hidden" name="version_id" value={versionId} />
          <select name="decision" className="input" aria-label="Decision">
            <option value="approved">Approve this version</option>
            <option value="changes_requested">Request changes</option>
          </select>
          <textarea name="note" rows={2} maxLength={1000} placeholder="Note (required when requesting changes)" className="input" aria-label="Note" />
          <FormMessage state={state} />
          <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Submit decision"}</button>
        </>
      )}
    </ActionForm>
  );
}
