import { requireSession } from "@/lib/auth";
import { Badge } from "@/components/badge";
import { fmtDate } from "@/lib/format";
import { sourceStatus } from "@/lib/source-status";
import type { Source } from "@/lib/types";
import { SourceForm } from "./source-form";

export default async function SourcesPage() {
  const s = await requireSession();
  const { data, error } = await s.supabase
    .from("approved_sources")
    .select("*")
    .eq("workspace_id", s.workspaceId)
    .order("type")
    .order("title");
  if (error) throw new Error("sources query failed");
  const sources = (data ?? []) as Source[];
  const isAdmin = s.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Approved sources</h1>
        <p className="mt-1 text-sm text-slate-600">
          Facts and brand rules that drafts are checked against. Only approved, in-date sources are used in reviews.
        </p>
      </div>

      {isAdmin ? (
        <details className="card">
          <summary className="cursor-pointer font-medium">Add a source</summary>
          <div className="mt-4"><SourceForm /></div>
        </details>
      ) : (
        <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          You can read sources. Only admins can add or edit them.
        </p>
      )}

      {sources.length === 0 ? (
        <div className="card text-sm text-slate-600">No sources yet. {isAdmin ? "Add the first fact or brand rule above." : "Ask an admin to add some."}</div>
      ) : (
        <ul className="space-y-3">
          {sources.map((src) => {
            const st = sourceStatus(src);
            return (
              <li key={src.id} className="card">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{src.title}</h2>
                  <Badge tone="navy">{src.type}</Badge>
                  <Badge>v{src.version}</Badge>
                  <Badge tone={src.approved ? "teal" : "amber"}>{src.approved ? "Approved" : "Not approved"}</Badge>
                  {st === "expired" && <Badge tone="red">Expired</Badge>}
                  {st === "not_yet_effective" && <Badge tone="amber">Not yet effective</Badge>}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{src.content}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Effective {fmtDate(src.effective_date)}{src.expiry_date ? ` · expires ${fmtDate(src.expiry_date)}` : " · no expiry"}
                </p>
                {isAdmin && (
                  <details className="mt-3 border-t border-slate-100 pt-3">
                    <summary className="cursor-pointer text-sm font-medium text-teal-700">Edit</summary>
                    <div className="mt-3"><SourceForm source={src} /></div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
