export type SourceStatus = "active" | "expired" | "not_yet_effective";

/** today = "YYYY-MM-DD". A source is expired the day after its expiry date. */
export function sourceStatus(
  s: { effective_date: string; expiry_date: string | null },
  today: string = new Date().toISOString().slice(0, 10),
): SourceStatus {
  if (s.expiry_date && s.expiry_date < today) return "expired";
  if (s.effective_date > today) return "not_yet_effective";
  return "active";
}
