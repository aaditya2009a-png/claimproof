const TONES: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700",
  teal: "bg-teal-50 text-teal-700",
  navy: "bg-navy-50 text-navy-700",
  red: "bg-red-100 text-red-800",
  amber: "bg-amber-100 text-amber-800",
};
export function Badge({ tone = "slate", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`badge ${TONES[tone]}`}>{children}</span>;
}

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  draft: "slate",
  analyzed: "navy",
  in_review: "amber",
  changes_requested: "red",
  approved: "teal",
};
export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "slate"}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </Badge>
  );
}
