import type { Finding, ProvidedSource } from "./schema";

const ABSOLUTE_GUARANTEE_REGEX =
  /\b(100%\s+guaranteed|risk[- ]free|zero\s+risk|instant\s+approval|guaranteed\s+returns?|never\s+fails?)\b/gi;

export function runDeterministicChecks(
  draft: string,
  sources: ProvidedSource[]
): Finding[] {
  const findings: Finding[] = [];
  const activeSources = sources.filter((s) => !s.expired);

  // 1. Banned terminology
  for (const src of activeSources.filter((s) => s.type === "terminology")) {
    const quotedTerms = [...src.content.matchAll(/["“']([^"”']{2,40})["”']/g)].map(
      (m) => m[1]
    );
    for (const term of quotedTerms) {
      const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
      let match: RegExpExecArray | null;
      while ((match = regex.exec(draft)) !== null) {
        findings.push({
          category: "terminology",
          severity: "blocking",
          flagged_text: match[0],
          explanation: `[Instant Rule] Banned term "${match[0]}" violates "${src.title}".`,
          evidence_status: "rule_applies",
          evidence: [
            {
              source_id: src.id,
              source_version: src.version,
              quote: src.content.slice(0, 240),
            },
          ],
          rule_references: [src.id],
          suggested_replacement: null,
          suggested_action: null,
        });
      }
    }
  }

  // 2. Absolute guarantees
  let guaranteeMatch: RegExpExecArray | null;
  while ((guaranteeMatch = ABSOLUTE_GUARANTEE_REGEX.exec(draft)) !== null) {
    findings.push({
      category: "unsupported_claim",
      severity: "blocking",
      flagged_text: guaranteeMatch[0],
      explanation: `[Instant Rule] Absolute guarantee "${guaranteeMatch[0]}" is not allowed.`,
      evidence_status: "no_support_found_in_reviewed_sources",
      evidence: [],
      rule_references: [],
      suggested_replacement: null,
      suggested_action: null,
    });
  }

  // 3. Missing required disclosures
  for (const src of activeSources.filter((s) => s.type === "disclosure")) {
    const requiredText = src.content.trim();
    if (requiredText && !draft.includes(requiredText)) {
      findings.push({
        category: "missing_disclosure",
        severity: "blocking",
        flagged_text: draft.slice(0, Math.min(80, draft.length)),
        explanation: `[Instant Rule] Missing required disclosure from "${src.title}".`,
        evidence_status: "rule_not_met",
        evidence: [
          {
            source_id: src.id,
            source_version: src.version,
            quote: requiredText.slice(0, 1000),
          },
        ],
        rule_references: [src.id],
        suggested_replacement: `${draft.trim()}\n\n${requiredText}`,
        suggested_action: null,
      });
    }
  }

  // 4. Number mismatches against approved facts
  const factNumbers = extractKeyNumbers(activeSources.filter((s) => s.type === "fact"));
  const draftNumbers = [
    ...draft.matchAll(/\b(\d[\d,.]*\s*(?:%|customers?|users?|ms|seconds?|days?|₹|\$))\b/gi),
  ];
  for (const m of draftNumbers) {
    const raw = m[1].trim();
    const unit = raw.replace(/[\d,.\s]/g, "").toLowerCase();
    const numericVal = parseFloat(raw.replace(/[^\d.]/g, ""));
    if (!unit || Number.isNaN(numericVal)) continue;

    const conflictingFact = factNumbers.find(
      (f) => f.unit === unit && f.value !== numericVal
    );
    if (conflictingFact) {
      findings.push({
        category: "contradicted_claim",
        severity: "blocking",
        flagged_text: raw,
        explanation: `[Instant Rule] "${raw}" conflicts with approved fact "${conflictingFact.raw}" in "${conflictingFact.source.title}".`,
        evidence_status: "contradicted",
        evidence: [
          {
            source_id: conflictingFact.source.id,
            source_version: conflictingFact.source.version,
            quote: conflictingFact.source.content.slice(0, 240),
          },
        ],
        rule_references: [],
        suggested_replacement: conflictingFact.raw,
        suggested_action: null,
      });
    }
  }

  return findings;
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractKeyNumbers(factSources: ProvidedSource[]) {
  const results: Array<{ value: number; unit: string; raw: string; source: ProvidedSource }> = [];
  for (const source of factSources) {
    for (const m of source.content.matchAll(
      /\b(\d[\d,.]*\s*(?:%|customers?|users?|ms|seconds?|days?|₹|\$))\b/gi
    )) {
      const raw = m[1].trim();
      const unit = raw.replace(/[\d,.\s]/g, "").toLowerCase();
      const value = parseFloat(raw.replace(/[^\d.]/g, ""));
      if (unit && !Number.isNaN(value)) {
        results.push({ value, unit, raw, source });
      }
    }
  }
  return results;
}