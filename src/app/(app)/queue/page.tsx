import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { StatusBadge } from "@/components/badge";
import { STATUS_LABELS, fmtDateTime, fmtWaitTime } from "@/lib/format";

export default async function QueuePage() {
  const s = await requireSession();
  if (!["reviewer", "admin"].includes(s.role)) {
    return (
      <div role="alert" className="card border-amber-200">
        <h1 className="text-lg font-semibold">Permission needed</h1>
        <p className="mt-1 text-sm text-slate-600">
          The reviewer queue is for reviewers and admins.
        </p>
      </div>
    );
  }

  const [subs, members] = await Promise.all([
    s.supabase
      .from("submissions")
      .select("id, title, status, creator_id, updated_at")
      .eq("workspace_id", s.workspaceId)
      .eq("status", "in_review")
      .order("updated_at"),
    s.supabase
      .from("workspace_members")
      .select("user_id, display_name")
      .eq("workspace_id", s.workspaceId),
  ]);

  if (subs.error || members.error) throw new Error("queue query failed");
  const names = new Map((members.data ?? []).map((m: any) => [m.user_id, m.display_name]));
  const items = subs.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="page-title">Reviewer queue</h1>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
          {items.length} waiting
        </span>
      </div>

      {items.length === 0 ? (
        <div className="card text-sm text-slate-600">Nothing is waiting for review.</div>
      ) : (
        <ul className="space-y-3">
          {items.map((r: any) => {
            const wait = fmtWaitTime(r.updated_at);
            return (
              <li
                key={r.id}
                className="card flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <Link
                    href={`/submissions/${r.id}`}
                    className="font-medium text-teal-700 hover:underline"
                  >
                    {r.title}
                  </Link>
                  <p className="text-sm text-slate-600">
                    By {names.get(r.creator_id) || "Unknown"} · {fmtDateTime(r.updated_at)}
                  </p>
                  {r.creator_id === s.userId && (
                    <p className="text-xs text-amber-800">
                      You created this, so another reviewer must decide.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      wait.urgent
                        ? "bg-rose-100 text-rose-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {wait.label}
                  </span>
                  <StatusBadge
                    status={r.status}
                    label={STATUS_LABELS[r.status] ?? r.status}
                  />
                  <Link
                    href={`/submissions/${r.id}`}
                    className="text-sm font-medium text-teal-700 hover:underline"
                  >
                    Review →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
