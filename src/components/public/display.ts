// Small display helpers for the public trust pages.

/** "15:47:12" in Lagos time. */
export function timeWATSeconds(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Africa/Lagos" });
}

/** "a3f9 08be 77d1 … 4e02 c21e" */
export function shortHex(hex: string): string {
  const h = hex.toLowerCase();
  const g = (s: string) => s.match(/.{1,4}/g)?.join(" ") ?? s;
  return h.length <= 20 ? g(h) : `${g(h.slice(0, 12))} … ${g(h.slice(-8))}`;
}

/** Full hex in groups of 4 (wraps nicely). */
export function groupHex(hex: string): string {
  return hex.toLowerCase().match(/.{1,4}/g)?.join(" ") ?? hex;
}
