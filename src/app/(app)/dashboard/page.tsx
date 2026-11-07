import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { StatusBadge } from "@/components/badge";
import { CATEGORY_LABELS, STATUS_LABELS, fmtDateTime } from "@/lib/format";

export default async function DashboardPage() {
  const s = await requireSession();
  const sb = s.supabase;
  const ws = s.workspaceId;

  const [total, pending, approved, findings, recent, members] = await Promise.all([
    sb.from("submissions").select("id", { count: "exact", head: true }).eq("workspace_id", ws),
    sb.from("submissions").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "in_review"),
    sb.from("approvals").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("decision", "approved"),
    sb.from("findings").select("category").eq("workspace_id", ws).limit(5000),
    sb.from("submissions").select("id, title, status, creator_id, updated_at").eq("workspace_id", ws).order("updated_at", { ascending: false }).limit(10),
    sb.from("workspace_members").select("user_id, display_name").eq("workspace_id", ws),
  ]);

  if ([total, pending, approved, findings, recent, members].some((r) => r.error)) {
    throw new Error("dashboard query failed");
  }

  const names = new Map((members.data ?? []).map((m: any) => [m.user_id, m.display_name]));
  const byCategory = new Map<string, number>();
  for (const f of findings.data ?? []) byCategory.set(f.category, (byCategory.get(f.category) ?? 0) + 1);
  const maxCount = Math.max(1, ...byCategory.values());

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
          <p className="mt-1 text-sm text-slate-600">Welcome, {s.displayName}. Here is where {s.workspaceName} stands.</p>
        </div>
        {s.role !== "reviewer" && <Link href="/submissions/new" className="btn-primary">New submission</Link>}
      </div>

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
            <p className="mt-3 text-sm text-slate-600">No findings yet. Findings appear after a draft has been reviewed.</p>
          ) : (
            <ul className="mt-4 space-y-4 text-sm">
              {[...byCategory.entries()].map(([cat, n]) => (
                <li key={cat}>
                  <div className="flex justify-between">
                    <span>{CATEGORY_LABELS[cat] ?? cat}</span>
                    <span className="font-medium">{n}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-teal-600" style={{ width: `${(n / maxCount) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card lg:col-span-2">
          <h2 className="font-semibold">Recent submissions</h2>
          {(recent.data ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No submissions yet. Create the first one to get started.</p>
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
                      <td className="py-3 pr-4"><Link href={`/submissions/${r.id}`} className="font-medium text-teal-700 hover:underline">{r.title}</Link></td>
                      <td className="py-3 pr-4"><StatusBadge status={r.status} label={STATUS_LABELS[r.status] ?? r.status} /></td>
                      <td className="py-3 pr-4">{names.get(r.creator_id) || "Unknown"}</td>
                      <td className="py-3 whitespace-nowrap text-slate-600">{fmtDateTime(r.updated_at)}</td>
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
