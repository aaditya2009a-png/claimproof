import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { StatusBadge } from "@/components/badge";
import { CATEGORY_LABELS, STATUS_LABELS, fmtDateTime, fmtWaitTime } from "@/lib/format";
import { syncExpiredSourceAlerts } from "@/lib/review/stale";

export default async function DashboardPage() {
  const s = await requireSession();
  const sb = s.supabase;
  const ws = s.workspaceId;

  await syncExpiredSourceAlerts(sb, ws);

  const [total, pending, approved, findings, recent, members, staleSubs, changesRequested] =
    await Promise.all([
      sb.from("submissions").select("id", { count: "exact", head: true }).eq("workspace_id", ws),
      sb
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ws)
        .eq("status", "in_review"),
      sb
        .from("approvals")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ws)
        .eq("decision", "approved"),
      sb.from("findings").select("category").eq("workspace_id", ws).limit(5000),
      sb
        .from("submissions")
        .select("id, title, status, creator_id, updated_at")
        .eq("workspace_id", ws)
        .order("updated_at", { ascending: false })
        .limit(10),
      sb.from("workspace_members").select("user_id, display_name").eq("workspace_id", ws),
      sb
        .from("submissions")
        .select("id, title, recheck_reason, updated_at")
        .eq("workspace_id", ws)
        .eq("status", "approved")
        .eq("needs_recheck", true),
      sb
        .from("submissions")
        .select("id, title, creator_id, updated_at")
        .eq("workspace_id", ws)
        .eq("status", "changes_requested")
        .order("updated_at", { ascending: true }),
    ]);

  if ([total, pending, approved, findings, recent, members].some((r) => r.error)) {
    throw new Error("dashboard query failed");
  }

  const names = new Map((members.data ?? []).map((m: any) => [m.user_id, m.display_name]));
  const byCategory = new Map<string, number>();
  for (const f of findings.data ?? []) byCategory.set(f.category, (byCategory.get(f.category) ?? 0) + 1);
  const maxCount = Math.max(1, ...byCategory.values());

  const myChangesRequested = (changesRequested.data ?? []).filter(
    (c: any) => s.role === "admin" || c.creator_id === s.userId
  );

  const stats = [
    { label: "Total submissions", value: total.count ?? 0, accent: "border-t-navy-600" },
    { label: "Pending reviews", value: pending.count ?? 0, accent: "border-t-amber-500" },
    { label: "Approved versions", value: approved.count ?? 0, accent: "border-t-teal-600" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Welcome, {s.displayName}. Here is where {s.workspaceName} stands.
          </p>
        </div>
        {s.role !== "reviewer" && (
          <Link href="/submissions/new" className="btn-primary">
            New submission
          </Link>
        )}
      </div>

      {/* Stale-Content Alerts */}
      {(staleSubs.data ?? []).length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">
            Stale-Content Alerts ({staleSubs.data!.length})
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            These approved submissions rely on sources that were updated or have expired:
          </p>
          <ul className="mt-3 divide-y divide-amber-200 text-sm">
            {staleSubs.data!.map((sub: any) => (
              <li key={sub.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <span className="font-medium text-amber-950">{sub.title}</span>
                  {sub.recheck_reason && (
                    <span className="ml-2 text-amber-800">— {sub.recheck_reason}</span>
                  )}
                </div>
                <Link
                  href={`/submissions/${sub.id}`}
                  className="font-medium text-amber-900 underline hover:text-amber-950"
                >
                  Re-review now →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Changes Requested Action Queue */}
      {myChangesRequested.length > 0 && (
        <section className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <h2 className="font-semibold text-rose-900">
            Action Required: Changes Requested ({myChangesRequested.length})
          </h2>
          <ul className="mt-3 divide-y divide-rose-200 text-sm">
            {myChangesRequested.map((sub: any) => {
              const wait = fmtWaitTime(sub.updated_at);
              return (
                <li key={sub.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <span className="font-medium text-rose-950">{sub.title}</span>
                    <span className="ml-2 text-xs text-rose-700">({wait.label})</span>
                  </div>
                  <Link
                    href={`/submissions/${sub.id}`}
                    className="font-medium text-rose-900 underline hover:text-rose-950"
                  >
                    Revise Draft →
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-label="Totals" className="grid gap-4 sm:grid-cols-3">
        {stats.map((x) => (
          <div key={x.label} className={`card border-t-4 ${x.accent}`}>
            <p className="text-sm text-slate-600">{x.label}</p>
            <p className="mt-1 text-4xl font-semibold text-navy-800">{x.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-1">
          <h2 className="font-semibold">Findings by category</h2>
          {byCategory.size === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              No findings yet. Findings appear after a draft has been reviewed.
            </p>
          ) : (
            <ul className="mt-4 space-y-4 text-sm">
              {[...byCategory.entries()].map(([cat, n]) => (
                <li key={cat}>
                  <div className="flex justify-between">
                    <span>{CATEGORY_LABELS[cat] ?? cat}</span>
                    <span className="font-medium">{n}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-teal-600"
                      style={{ width: `${(n / maxCount) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card lg:col-span-2">
          <h2 className="font-semibold">Recent submissions</h2>
          {(recent.data ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              No submissions yet. Create the first one to get started.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Title</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Creator</th>
                    <th className="py-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(recent.data ?? []).map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/submissions/${r.id}`}
                          className="font-medium text-teal-700 hover:underline"
                        >
                          {r.title}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge
                          status={r.status}
                          label={STATUS_LABELS[r.status] ?? r.status}
                        />
                      </td>
                      <td className="py-3 pr-4">{names.get(r.creator_id) || "Unknown"}</td>
                      <td className="py-3 whitespace-nowrap text-slate-600">
                        {fmtDateTime(r.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
