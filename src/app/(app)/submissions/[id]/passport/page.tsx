import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { CATEGORY_LABELS, STATUS_LABELS, fmtDate, fmtDateTime } from "@/lib/format";
import { PrintButton } from "./print-button";

export default async function PassportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const s = await requireSession();
  const sb = s.supabase;

  const { data: sub } = await sb.from("submissions").select("*").eq("id", id).eq("workspace_id", s.workspaceId).maybeSingle();
  if (!sub) notFound();
  const [ver, members, approvals, runs] = await Promise.all([
    sb.from("submission_versions").select("id, version_number, content, content_hash, created_at").eq("id", sub.current_version_id).maybeSingle(),
    sb.from("workspace_members").select("user_id, display_name").eq("workspace_id", s.workspaceId),
    sb.from("approvals").select("id, decision, note, reviewer_id, created_at, submission_version_id").eq("submission_id", id).order("created_at", { ascending: false }),
    sb.from("review_runs").select("id, model, source_coverage, sources_snapshot, completed_at, started_at")
      .eq("submission_version_id", sub.current_version_id).eq("status", "succeeded").order("started_at", { ascending: false }).limit(1),
  ]);
  const version = ver.data;
  if (!version) notFound();
  const names: Record<string, string> = Object.fromEntries((members.data ?? []).map((m: any) => [m.user_id, m.display_name || "Unknown"]));
  const run = runs.data?.[0];
  const { data: findings } = run ? await sb.from("findings").select("*").eq("review_run_id", run.id).order("created_at") : { data: [] as any[] };
  const ids = (findings ?? []).map((f: any) => f.id);
  const { data: decisions } = ids.length ? await sb.from("finding_decisions").select("*").in("finding_id", ids).order("created_at") : { data: [] as any[] };
  const approval = (approvals.data ?? []).find((a: any) => a.submission_version_id === version.id && a.decision === "approved");
  const snapshot: any[] = Array.isArray(run?.sources_snapshot) ? run!.sources_snapshot : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="no-print flex items-center justify-between">
        <Link href={`/submissions/${id}`} className="text-sm text-teal-700 hover:underline">← Back to submission</Link>
        <PrintButton />
      </div>

      <header className="border-b-2 border-teal-600 pb-3">
        <h1 className="page-title">Evidence Passport</h1>
        <p className="text-sm text-slate-600">Review record for {s.workspaceName}. This is a record of a review process, not a legal certificate.</p>
      </header>

      <section className="space-y-1 text-sm">
        <h2 className="font-semibold">Submission</h2>
        <p><b>Title:</b> {sub.title}</p>
        <p><b>Submission ID:</b> <code>{sub.id}</code></p>
        <p><b>Creator:</b> {names[sub.creator_id] ?? "Unknown"} · <b>Status:</b> {STATUS_LABELS[sub.status] ?? sub.status}</p>
        <p><b>Content version:</b> v{version.version_number} · saved {fmtDateTime(version.created_at)}</p>
        <p><b>Content hash (SHA-256):</b> <code className="break-all">{version.content_hash}</code></p>
        <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-3">{version.content}</pre>
      </section>

      <section className="space-y-1 text-sm">
        <h2 className="font-semibold">Approval</h2>
        {approval ? (
          <p>Approved by {names[approval.reviewer_id] ?? "Unknown"} on {fmtDateTime(approval.created_at)}{approval.note ? `. Note: ${approval.note}` : "."}</p>
        ) : (
          <p>This version is not approved. Current status: {STATUS_LABELS[sub.status] ?? sub.status}.</p>
        )}
        {(approvals.data ?? []).length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-slate-700">
            {(approvals.data ?? []).map((a: any) => (
              <li key={a.id}>{a.decision === "approved" ? "Approved" : "Changes requested"} by {names[a.reviewer_id] ?? "Unknown"}, {fmtDateTime(a.created_at)}{a.submission_version_id === version.id ? " (current version)" : " (earlier version)"}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-1 text-sm">
        <h2 className="font-semibold">AI review</h2>
        {run ? (
          <>
            <p>Completed {fmtDateTime(run.completed_at ?? run.started_at)} using {run.model}.</p>
            <p>Sources reviewed ({snapshot.length}):</p>
            <ul className="list-disc pl-5 text-slate-700">
              {snapshot.map((x) => (
                <li key={x.id}>{x.title} · {x.type} · v{x.version} · effective {fmtDate(x.effective_date)}{x.expiry_date ? ` · expires ${fmtDate(x.expiry_date)}` : ""}{x.expired ? " (expired, used only to spot outdated claims)" : ""} · <code>{x.id}</code></li>
              ))}
            </ul>
            {run.source_coverage?.warning && <p className="text-amber-800">Coverage warning: {run.source_coverage.warning}</p>}
          </>
        ) : (
          <p>No successful AI review exists for this version.</p>
        )}
      </section>

      <section className="space-y-3 text-sm">
        <h2 className="font-semibold">Findings and decisions ({(findings ?? []).length})</h2>
        {run && (findings ?? []).length === 0 && <p>No issues were found against the reviewed sources.</p>}
        {(findings ?? []).map((f: any) => (
          <article key={f.id} className="rounded border border-slate-200 p-3">
            <p><b>{f.severity.toUpperCase()}</b> · {CATEGORY_LABELS[f.category] ?? f.category}</p>
            <p>Flagged: “{f.flagged_text}”</p>
            <p className="text-slate-700">{f.explanation}</p>
            {(f.evidence ?? []).map((e: any, i: number) => {
              const src = snapshot.find((x) => x.id === e.source_id);
              return <p key={i} className="mt-1 italic">Evidence ({src?.title ?? "source"} v{e.source_version}): “{e.quote}”</p>;
            })}
            {f.suggested_replacement && <p className="mt-1">Suggested correction: {f.suggested_replacement}</p>}
            {f.suggested_action && <p className="mt-1">Suggested action: {f.suggested_action}</p>}
            {(decisions ?? []).filter((d: any) => d.finding_id === f.id).map((d: any) => (
              <p key={d.id} className="mt-1 rounded bg-slate-50 px-2 py-1">{d.decision} by {names[d.decided_by] ?? "Unknown"} ({fmtDateTime(d.created_at)}): {d.reason}</p>
            ))}
          </article>
        ))}
      </section>

      <section className="space-y-1 text-sm">
        <h2 className="font-semibold">Limitations</h2>
        <ul className="list-disc pl-5 text-slate-700">
          <li>AI review can miss issues or flag correct text. A human reviewer made the final decision.</li>
          <li>Missing evidence in the reviewed sources does not prove a statement false.</li>
          <li>Only the sources listed above were checked. This MVP reviews text only, not images, video or accessibility.</li>
          <li>This record does not certify legal or regulatory compliance.</li>
        </ul>
      </section>
    </div>
  );
}
