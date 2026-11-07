"use client";
import { ActionForm } from "@/components/action-form";
import { FormMessage } from "@/components/form-message";
import { LIMITS, SOURCE_TYPES } from "@/lib/validation";
import type { Source } from "@/lib/types";
import { saveSource } from "./actions";

export function SourceForm({ source }: { source?: Source }) {
  return (
    <ActionForm action={saveSource} className="space-y-4">
      {({ state, pending }) => (
        <>
          {source && <input type="hidden" name="id" value={source.id} />}
          <div>
            <label className="label" htmlFor={`title-${source?.id ?? "new"}`}>Title</label>
            <input id={`title-${source?.id ?? "new"}`} name="title" required minLength={3} maxLength={LIMITS.sourceTitle} defaultValue={source?.title} className="input" />
          </div>
          <div>
            <label className="label" htmlFor={`content-${source?.id ?? "new"}`}>Content</label>
            <textarea id={`content-${source?.id ?? "new"}`} name="content" required minLength={10} maxLength={LIMITS.sourceContent} rows={4} defaultValue={source?.content} className="input" />
            <p className="mt-1 text-xs text-slate-500">Up to {LIMITS.sourceContent} characters. Reviews quote this text exactly, so write it as it should be cited.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor={`type-${source?.id ?? "new"}`}>Type</label>
              <select id={`type-${source?.id ?? "new"}`} name="type" defaultValue={source?.type ?? "fact"} className="input">
                {SOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor={`eff-${source?.id ?? "new"}`}>Effective date</label>
              <input id={`eff-${source?.id ?? "new"}`} type="date" name="effective_date" required defaultValue={source?.effective_date ?? new Date().toISOString().slice(0, 10)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor={`exp-${source?.id ?? "new"}`}>Expiry date (optional)</label>
              <input id={`exp-${source?.id ?? "new"}`} type="date" name="expiry_date" defaultValue={source?.expiry_date ?? ""} className="input" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="approved" defaultChecked={source?.approved ?? false} className="h-4 w-4 accent-teal-600" />
            Approved for use in reviews
          </label>
          <FormMessage state={state} />
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Saving…" : source ? "Save changes" : "Add source"}
          </button>
        </>
      )}
    </ActionForm>
  );
}
