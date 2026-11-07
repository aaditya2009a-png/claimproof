import { GoogleGenAI } from "@google/genai";
import { RESPONSE_JSON_SCHEMA } from "./schema";

export class ReviewError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export const modelName = () => process.env.AI_MODEL || "gemini-3.8-flash";

function classify(e: unknown): ReviewError {
  if (e instanceof ReviewError) return e;
  const err = e as { status?: number; name?: string; message?: string };
  if (err?.name === "AbortError") return new ReviewError("timeout");
  if (err?.status === 429) return new ReviewError("rate_limited");
  if (err?.status === 401 || err?.status === 403) return new ReviewError("auth");
  if (err?.status === 400 && /api key/i.test(err.message ?? "")) return new ReviewError("auth");
  return new ReviewError("provider_error");
}

/** One Gemini call with a timeout and at most one retry for transient errors (429, 5xx, timeout). */
export async function callGemini(system: string, user: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || (process.env.AI_PROVIDER ?? "gemini") !== "gemini") throw new ReviewError("not_configured");
  const ai = new GoogleGenAI({ apiKey });
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 45000;

  let last: ReviewError = new ReviewError("provider_error");
  for (let attempt = 0; attempt < 2; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await ai.models.generateContent({
        model: modelName(),
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema: RESPONSE_JSON_SCHEMA,
          abortSignal: ac.signal,
        },
      });
      if (!res.text) throw new ReviewError("empty_response");
      return res.text;
    } catch (e) {
      last = classify(e);
      // Log only the error code, never draft or source text.
      console.error("gemini call failed:", last.code);
      if (last.code === "auth" || last.code === "not_configured") throw last;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    } finally {
      clearTimeout(timer);
    }
  }
  throw last;
}
