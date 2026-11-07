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
