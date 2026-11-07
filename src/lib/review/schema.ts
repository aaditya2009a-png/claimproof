import { z } from "zod";

export const CATEGORIES = [
  "unsupported_claim", "contradicted_claim", "outdated_information", "terminology", "tone", "missing_disclosure",
] as const;
export const SEVERITIES = ["blocking", "warning", "info"] as const;
export const EVIDENCE_STATUSES = [
  "supported", "contradicted", "outdated", "no_support_found_in_reviewed_sources", "rule_applies", "rule_not_met",
] as const;

export const evidenceSchema = z.object({
  source_id: z.string().uuid(),
  source_version: z.number().int().positive(),
  quote: z.string().min(1).max(1000),
});

export const findingSchema = z.object({
  category: z.enum(CATEGORIES),
  severity: z.enum(SEVERITIES),
  flagged_text: z.string().min(1).max(1000),
  explanation: z.string().min(1).max(1500),
  evidence_status: z.enum(EVIDENCE_STATUSES),
  evidence: z.array(evidenceSchema).max(5),
  rule_references: z.array(z.string().uuid()).max(5),
  suggested_replacement: z.string().max(1000).nullable(),
  suggested_action: z.string().max(500).nullable(),
});
export const reviewOutputSchema = z.object({ findings: z.array(findingSchema).max(25) });

export type Finding = z.infer<typeof findingSchema>;
export type Category = (typeof CATEGORIES)[number];
export type Severity = (typeof SEVERITIES)[number];

/** A source as sent to the model and stored in review_runs.sources_snapshot. */
export type ProvidedSource = {
  id: string;
  version: number;
  type: string;
  title: string;
  content: string;
  effective_date: string;
  expiry_date: string | null;
  expired: boolean;
};

export type Coverage = {
  total_approved: number;
  active_used: number;
  expired_used: number;
  not_yet_effective_skipped: number;
  omitted_for_budget: number;
  chars_used: number;
  char_budget: number;
  warning: string | null;
};

// JSON Schema sent to Gemini (responseJsonSchema). Empty string means "none" for the two optional fields.
const str = { type: "string" };
export const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: [...CATEGORIES] },
          severity: { type: "string", enum: [...SEVERITIES] },
          flagged_text: str,
          explanation: str,
          evidence_status: { type: "string", enum: [...EVIDENCE_STATUSES] },
          evidence: {
            type: "array",
            items: {
              type: "object",
              properties: { source_id: str, source_version: { type: "integer" }, quote: str },
              required: ["source_id", "source_version", "quote"],
            },
          },
          rule_references: { type: "array", items: str },
          suggested_replacement: { type: "string", description: "Empty string if none." },
          suggested_action: { type: "string", description: "Empty string if none." },
        },
        required: [
          "category", "severity", "flagged_text", "explanation", "evidence_status", "evidence",
          "rule_references", "suggested_replacement", "suggested_action",
        ],
      },
    },
  },
  required: ["findings"],
};

/** Turns "" into null for the two optional fields before Zod validation. */
export function normalizeRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as any).findings)) return raw;
  return {
    findings: (raw as any).findings.map((f: any) => ({
      ...f,
      suggested_replacement: f?.suggested_replacement ? f.suggested_replacement : null,
      suggested_action: f?.suggested_action ? f.suggested_action : null,
      rule_references: f?.rule_references ?? [],
    })),
  };
}
