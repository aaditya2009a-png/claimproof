export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}
export function fmtDate(d: string): string {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { timeZone: "UTC", dateStyle: "medium" });
}
export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  analyzed: "Analyzed",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
};
export const CATEGORY_LABELS: Record<string, string> = {
  unsupported_claim: "Unsupported claim",
  contradicted_claim: "Contradicted claim",
  outdated_information: "Outdated information",
  terminology: "Terminology",
  tone: "Tone",
  missing_disclosure: "Missing disclosure",
};
export function fmtWaitTime(isoTimestamp: string): {
  label: string;
  urgent: boolean;
} {
  const diffMs = Date.now() - new Date(isoTimestamp).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60_000));
  if (mins < 60) return { label: `${mins}m waiting`, urgent: false };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { label: `${hours}h waiting`, urgent: hours >= 8 };
  const days = Math.floor(hours / 24);
  return { label: `${days}d ${hours % 24}h waiting`, urgent: true };
}
