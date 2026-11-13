import type { Source } from "@/lib/types";

export interface RuleFinding {
  category:
    | "terminology"
    | "contradicted_claim"
    | "unsupported_claim"
    | "missing_disclosure";
  severity: "blocking" | "warning";
  flagged_text: string;
  explanation: string;
  source_id: string | null;
  source_version: number | null;
  source_quote: string | null;
  suggested_replacement: string | null;
}

const ABSOLUTE_GUARANTEE_REGEX =
  /\b(100%\s+guaranteed|risk[- ]free|zero\s+risk|instant\s+approval|guaranteed\s+returns?|never\s+fails?)\b/gi;

export function runDeterministicChecks(
  draftContent: string,
  sources: Source[]
): RuleFinding[] {
  const findings: RuleFinding[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const activeSources = sources.filter(
    (s) => s.approved && (!s.expiry_date || s.expiry_date >= today)
  );

  // 1. Banned terminology (matches quoted terms in terminology sources)
  for (const src of activeSources.filter((s) => s.type === "terminology")) {
    const quotedTerms = [...src.content.matchAll(/["“']([^"”']{2,40})["”']/g)].map(
      (m) => m[1]
    );
    for
