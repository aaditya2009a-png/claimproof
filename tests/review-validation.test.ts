import { describe, it, expect } from "vitest";
import { validateFindings, applySeverityFloor } from "@/lib/review/validate";
import { normalizeRaw, reviewOutputSchema, type Finding, type ProvidedSource } from "@/lib/review/schema";

const ID = "11111111-1111-4111-8111-111111111111";
const OLD = "22222222-2222-4222-8222-222222222222";
const sources: ProvidedSource[] = [
  { id: ID, version: 1, type: "fact", title: "Current customer count", effective_date: "2026-10-01", expiry_date: null, expired: false,
    content: "As of 1 October 2026, PayNest serves 12,400 active small-business customers." },
  { id: OLD, version: 1, type: "fact", title: "Old count", effective_date: "2023-01-01", expiry_date: "2024-01-01", expired: true,
    content: "In January 2023, PayNest served 5,000 small-business customers." },
];
const draft = "Join the 25,000 small businesses already using PayNest.";

const base: Finding = {
  category: "contradicted_claim", severity: "blocking", flagged_text: "25,000 small businesses",
  explanation: "The approved count is different.", evidence_status: "contradicted",
  evidence: [{ source_id: ID, source_version: 1, quote: "PayNest serves 12,400 active small-business customers." }],
  rule_references: [], suggested_replacement: "Join the 12,400 small businesses already using PayNest.", suggested_action: null,
};
const check = (f: Partial<Finding>) => validateFindings([{ ...base, ...f }], sources, draft);

describe("validateFindings", () => {
  it("accepts a correctly cited finding", () => expect(check({}).ok).toBe(true));
  it("rejects an unknown citation", () =>
    expect(check({ evidence: [{ ...base.evidence[0], source_id: "99999999-9999-4999-8999-999999999999" }] }).ok).toBe(false));
  it("rejects an incorrect source quote", () =>
    expect(check({ evidence: [{ ...base.evidence[0], quote: "PayNest serves 25,000 customers." }] }).ok).toBe(false));
  it("rejects a wrong source version", () =>
    expect(check({ evidence: [{ ...base.evidence[0], source_version: 7 }] }).ok).toBe(false));
  it("rejects flagged text that is not in the draft", () => expect(check({ flagged_text: "ten million users" }).ok).toBe(false));
  it("rejects evidence when status says no support was found", () =>
    expect(check({ evidence_status: "no_support_found_in_reviewed_sources" }).ok).toBe(false));
  it("rejects a replacement with no evidence", () =>
    expect(check({ evidence_status: "no_support_found_in_reviewed_sources", evidence: [] }).ok).toBe(false));
  it("accepts an unsupported claim with no evidence and no replacement", () =>
    expect(check({ category: "unsupported_claim", evidence_status: "no_support_found_in_reviewed_sources", evidence: [], suggested_replacement: null, suggested_action: "Remove the claim." }).ok).toBe(true));
  it("rejects an expired source cited as current evidence", () =>
    expect(check({ evidence: [{ source_id: OLD, source_version: 1, quote: "PayNest served 5,000 small-business customers." }] }).ok).toBe(false));
  it("allows an expired source for outdated information", () =>
    expect(check({ category: "outdated_information", evidence_status: "outdated", suggested_replacement: null,
      evidence: [{ source_id: OLD, source_version: 1, quote: "PayNest served 5,000 small-business customers." }] }).ok).toBe(true));
});

describe("severity floor and schema", () => {
  it("cannot downgrade a contradicted claim below blocking", () =>
    expect(applySeverityFloor({ ...base, severity: "info" }).severity).toBe("blocking"));
  it("rejects an unknown category", () =>
    expect(reviewOutputSchema.safeParse({ findings: [{ ...base, category: "made_up" }] }).success).toBe(false));
  it("turns empty optional strings into null", () => {
    const raw: any = normalizeRaw({ findings: [{ ...base, suggested_replacement: "", suggested_action: "" }] });
    expect(raw.findings[0].suggested_replacement).toBeNull();
  });
});
