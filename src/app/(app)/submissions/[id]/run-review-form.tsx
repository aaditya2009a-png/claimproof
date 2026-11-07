"use client";
import { ActionForm } from "@/components/action-form";
import { FormMessage } from "@/components/form-message";
import { runReview } from "./review-actions";

export function RunReviewForm({ submissionId, retry }: { submissionId: string; retry: boolean }) {
  return (
    <ActionForm action={runReview} className="space-y-3">
      {({ state, pending }) => (
        <>
          <input type="hidden" name="id" value={submissionId} />
          <FormMessage state={state} />
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Reviewing… this can take up to a minute" : retry || state.error ? "Retry review" : "Run AI review"}
          </button>
        </>
      )}
    </ActionForm>
  );
}
