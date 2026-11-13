import type { Finding, ProvidedSource } from "./schema";

const ABSOLUTE_GUARANTEE_REGEX =
  /\b(100%\s+guaranteed|risk[- ]free|zero\s+risk|instant\s+approval|guaranteed\s+returns?|never\s+fails?)\b/gi;

export function runDeterministicChecks(
  draft: string,
  sources: ProvidedSource[]
): Finding[] {
  const findings: Finding[] = [];
  const activeSources = sources.filter((s) => !s.is_expired);

  // 1. Banned terminology (matches quoted terms in terminology sources)
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
          source_id: src.id,
          source_version: src.version,
          source_quote: src.content.slice(0, 240),
          suggested_replacement: null,
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
      source_id: null,
      source_version: null,
      source_quote: null,
      suggested_replacement: null,
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
        source_id: src.id,
        source_version: src.version,
        source_quote: requiredText,
        suggested_replacement: `${draft.trim()}\n\n${requiredText}`,
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
        source_id: conflictingFact.source.id,
        source_version: conflictingFact.source.version,
        source_quote: conflictingFact.source.content.slice(0, 240),
        suggested_replacement: conflictingFact.raw,
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
