import type { Category, Finding, ProvidedSource, Severity } from "./schema";

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

const FLOOR: Record<Category, Severity> = {
  unsupported_claim: "blocking",
  contradicted_claim: "blocking",
  outdated_information: "blocking",
  missing_disclosure: "blocking",
  terminology: "warning",
  tone: "info",
};
const RANK: Record<Severity, number> = { info: 0, warning: 1, blocking: 2 };

/** Deterministic minimum severity per category, so the model cannot downgrade a blocker. */
export function applySeverityFloor(f: Finding): Finding {
  const floor = FLOOR[f.category];
  return RANK[f.severity] >= RANK[floor] ? f : { ...f, severity: floor };
}

export type ValidationResult = { ok: true; findings: Finding[] } | { ok: false; problems: string[] };

/**
 * Checks every finding against what was actually sent to the model. Any problem rejects the whole output:
 * unknown source IDs, wrong versions, quotes that are not exact text from that source, flagged text that is
 * not in the draft, and replacements that have no supporting evidence.
 */
export function validateFindings(findings: Finding[], sources: ProvidedSource[], draft: string): ValidationResult {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const nDraft = norm(draft);
  const problems: string[] = [];

  findings.forEach((f, i) => {
    const tag = `finding ${i + 1}`;
    if (!nDraft.includes(norm(f.flagged_text))) problems.push(`${tag}: flagged_text is not an exact excerpt of the draft`);

    if (f.evidence_status === "no_support_found_in_reviewed_sources") {
      if (f.evidence.length > 0) problems.push(`${tag}: evidence must be empty when no support was found`);
    } else if (f.evidence.length === 0) {
      problems.push(`${tag}: evidence is required for status ${f.evidence_status}`);
    }
    if (f.evidence.length === 0 && f.suggested_replacement) {
      problems.push(`${tag}: suggested_replacement requires supporting evidence`);
    }

    for (const e of f.evidence) {
      const src = byId.get(e.source_id);
      if (!src) problems.push(`${tag}: unknown source_id`);
      else if (src.version !== e.source_version) problems.push(`${tag}: wrong source_version for a cited source`);
      else if (!norm(src.content).includes(norm(e.quote))) problems.push(`${tag}: quote is not exact text from the cited source`);
      else if (src.expired && f.evidence_status !== "outdated") problems.push(`${tag}: expired source cited as current evidence`);
    }
    for (const id of f.rule_references) {
      if (!byId.has(id)) problems.push(`${tag}: unknown rule reference`);
    }
  });

  return problems.length ? { ok: false, problems } : { ok: true, findings: findings.map(applySeverityFloor) };
}
