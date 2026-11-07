"use client";
import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormMessage } from "@/components/form-message";
import { LIMITS } from "@/lib/validation";
import { createSubmission, saveDraft } from "./actions";

export function DraftForm({ submissionId, initialTitle = "", initialContent = "" }: { submissionId?: string; initialTitle?: string; initialContent?: string }) {
  const [len, setLen] = useState(initialContent.length);
  return (
    <ActionForm action={submissionId ? saveDraft : createSubmission} className="space-y-4">
      {({ state, pending }) => (
        <>
          {submissionId && <input type="hidden" name="id" value={submissionId} />}
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input id="title" name="title" required minLength={3} maxLength={LIMITS.draftTitle} defaultValue={initialTitle} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="content">Draft text</label>
            <textarea
              id="content" name="content" required minLength={10} maxLength={LIMITS.draftContent} rows={12}
              defaultValue={initialContent} onChange={(e) => setLen(e.target.value.length)} className="input font-mono"
            />
            <p className="mt-1 text-xs text-slate-500">{len.toLocaleString()} / {LIMITS.draftContent.toLocaleString()} characters</p>
          </div>
          <FormMessage state={state} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save draft"}</button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
