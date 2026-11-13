import { runDeterministicChecks } from "./deterministic";
import { callGemini, ReviewError } from "./gemini";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import { normalizeRaw, reviewOutputSchema, type Finding, type ProvidedSource } from "./schema";
import { validateFindings } from "./validate";

/** Runs deterministic rule checks first, then calls the model for judgment calls and validates citations. */
export async function reviewDraft(draft: string, sources: ProvidedSource[]): Promise<Finding[]> {
  const instantFindings = runDeterministicChecks(draft, sources);

  let feedback = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callGemini(SYSTEM_PROMPT, buildUserPrompt(draft, sources, feedback));
    let problems: string[] = [];
    try {
      const parsed = reviewOutputSchema.safeParse(normalizeRaw(JSON.parse(text)));
      if (parsed.success) {
        const v = validateFindings(parsed.data.findings, sources, draft);
        if (v.ok) return [...instantFindings, ...v.findings];
        problems = v.problems;
      } else problems = ["output did not match the required JSON schema"];
    } catch {
      problems = ["output was not valid JSON"];
    }
    feedback = `Your previous answer was rejected: ${problems.slice(0, 6).join("; ")}. Fix these problems and answer again.`;
  }
  throw new ReviewError("invalid_output");
}
