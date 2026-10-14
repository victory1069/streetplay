/** Only allow same-site relative redirects after sign-in (no open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/studio"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
