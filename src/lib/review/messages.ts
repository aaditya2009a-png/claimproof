export const REVIEW_ERROR_MESSAGES: Record<string, string> = {
  not_configured: "AI review is not configured on the server yet. Add GEMINI_API_KEY and SUPABASE_SERVICE_ROLE_KEY to .env.local and restart.",
  auth: "The AI provider rejected the API key. Check GEMINI_API_KEY.",
  rate_limited: "The AI provider's rate limit or free quota was reached. Wait a minute, then press Retry.",
  timeout: "The AI provider took too long to respond. Press Retry.",
  invalid_output: "The AI returned a result that failed validation, so it was discarded. Press Retry.",
  empty_response: "The AI returned an empty response. Press Retry.",
  provider_error: "The AI provider returned an error. Press Retry.",
  stale_version: "The draft changed while the review was running, so the result was discarded. Run the review again.",
  unexpected: "The review failed unexpectedly. Press Retry.",
};
export const reviewErrorMessage = (code?: string | null) =>
  REVIEW_ERROR_MESSAGES[code ?? ""] ?? "The review did not complete. Press Retry.";
