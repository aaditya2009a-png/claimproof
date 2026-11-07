import { requireSession } from "@/lib/auth";
import { DraftForm } from "../draft-form";

export default async function NewSubmissionPage() {
  const s = await requireSession();
  if (s.role === "reviewer") {
    return (
      <div role="alert" className="card border-amber-200">
        <h1 className="text-lg font-semibold">Permission needed</h1>
        <p className="mt-1 text-sm text-slate-600">Reviewers cannot create submissions. Sign in as a creator or admin.</p>
      </div>
    );
  }
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">New submission</h1>
      <div className="card"><DraftForm /></div>
    </div>
  );
}
