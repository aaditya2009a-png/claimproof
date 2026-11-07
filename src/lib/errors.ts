/** Shows our own database messages ("claimproof: ...") and hides everything else. */
export function userMessage(error: { message?: string; code?: string } | null, fallback: string): string {
  if (error?.message?.startsWith("claimproof:")) return error.message.slice("claimproof:".length).trim();
  if (error?.code === "42501") return "You do not have permission to do that.";
  return fallback;
}
