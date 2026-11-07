import { Badge } from "@/components/badge";
import { CATEGORY_LABELS, fmtDateTime } from "@/lib/format";
import { reviewErrorMessage } from "@/lib/review/messages";
import { DecisionForm } from "./workflow-forms";

export type Viewer = { userId: string; role: string; isCreator: boolean; status: string; submissionId: string };
const DECISION_LABEL: Record<string, string> = { disputed: "Disputed", dismissed: "Dismissed", resolved: "Resolved", overridden: "Overridden" };

function decisionOptions(f: any, v: Viewer) {
  if (v.isCreator && v.status !== "approved") {
    const o = [{ value: "disputed", label: "Dispute" }];
    if (f.severity !== "blocking" && v.status !== "in_review") o.push({ value: "dismissed", label: "Dismiss" });
    return o;
  }
  if (!v.isCreator && ["reviewer", "admin"].includes(v.role) && v.status === "in_review") {
    return [{ value: "resolved", label: "Resolve" }, { value: "overridden", label: "Override" }];
  }
  return [];
}

const GROUPS = [
  { key: "blocking", label: "Blocking issues", tone: "red", border: "border-l-red-500" },
  { key: "warning", label: "Warnings", tone: "amber", border: "border-l-amber-500" },
  { key: "info", label: "Notes", tone: "navy", border: "border-l-navy-600" },
] as const;

export function ReviewPanel({ run, findings, decisions, names, viewer }: { run: any; findings: any[]; decisions: any[]; names: Record<string, string>; viewer: Viewer }) {
  const snapshot: any[] = Array.isArray(run.sources_snapshot) ? run.sources_snapshot : [];
  const byId = new Map(snapshot.map((x) => [x.id, x]));
  const cov = run.source_coverage ?? {};
  const stale = run.status === "running" && Date.now() - new Date(run.started_at).getTime() > 3 * 60 * 1000;

  if (run.status === "failed" || stale) {
    return (
      <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        The last review did not complete. {reviewErrorMessage(stale ? "timeout" : run.error_code)} No findings were recorded and the draft was not approved.
      </div>
    );
  }
  if (run.status === "running") return <p className="text-sm text-slate-600">A review is running. Refresh in a moment.</p>;

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        Reviewed {fmtDateTime(run.completed_at ?? run.started_at)} with {run.model} against {cov.active_used ?? 0} current source(s)
        {cov.expired_used ? ` and ${cov.expired_used} expired source(s) (used only to spot outdated claims)` : ""}.
        {cov.not_yet_effective_skipped ? ` ${cov.not_yet_effective_skipped} not-yet-effective source(s) were skipped.` : ""}
      </div>
      {cov.warning && (
        <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Coverage warning: {cov.warning}
        </div>
      )}

      {findings.length === 0 && (
        <p className="text-sm text-slate-700">
          No issues were found against the reviewed sources. This does not prove the draft is accurate or compliant.
        </p>
      )}

      {GROUPS.map((g) => {
        const items = findings.filter((f) => f.severity === g.key);
        if (items.length === 0) return null;
        return (
          <section key={g.key} className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold">
              {g.label} <Badge tone={g.tone}>{items.length}</Badge>
            </h3>
            {items.map((f) => (
              <article key={f.id} className={`space-y-3 rounded-lg border border-slate-200 border-l-4 bg-white p-4 ${g.border}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={g.tone}>{g.key}</Badge>
                  <Badge>{CATEGORY_LABELS[f.category] ?? f.category}</Badge>
                </div>
                <p className="text-sm">
                  Flagged: <mark className="rounded bg-red-50 px-1 text-red-800">{f.flagged_text}</mark>
                </p>
                <p className="text-sm text-slate-700">{f.explanation}</p>
                {(f.evidence ?? []).map((e: any, i: number) => {
                  const src = byId.get(e.source_id);
                  return (
                    <blockquote key={i} className="rounded-md bg-slate-50 p-3 text-sm">
                      <div className="mb-1 text-xs text-slate-500">
                        Evidence · {src?.title ?? "Unknown source"} · v{e.source_version}{src?.expired ? " (expired)" : ""}
                      </div>
                      <span className="italic">“{e.quote}”</span>
                    </blockquote>
                  );
                })}
                {(f.evidence ?? []).length === 0 && (
                  <p className="text-xs text-slate-500">No supporting evidence was found in the reviewed sources. That does not prove the statement false.</p>
                )}
                {f.suggested_replacement && (
                  <div className="rounded-md bg-teal-50 p-3 text-sm text-teal-700">
                    <div className="mb-1 text-xs">Suggested correction</div>
                    {f.suggested_replacement}
                  </div>
                )}
                {f.suggested_action && (
                  <p className="text-sm"><span className="font-medium">Suggested action:</span> {f.suggested_action}</p>
                )}
                {decisions.filter((d) => d.finding_id === f.id).map((d) => (
                  <p key={d.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-medium">{DECISION_LABEL[d.decision] ?? d.decision}</span> by {names[d.decided_by] ?? "Unknown"}: {d.reason}
                  </p>
                ))}
                {decisionOptions(f, viewer).length > 0 && (
                  <DecisionForm submissionId={viewer.submissionId} findingId={f.id} options={decisionOptions(f, viewer)} />
                )}
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
