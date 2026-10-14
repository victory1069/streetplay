// Commit-reveal fairness (spec § Fairness).
// Before a round: generate a seed and publish sha256(seed).
// After: reveal the seed; anyone can re-hash it and replay the draws.
// Uses Web Crypto so it runs the same in the browser, offline, and on the server.

export function generateSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toHex(bytes);
}

export async function commitSeed(seed: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  return toHex(new Uint8Array(digest));
}

export async function verifySeed(seed: string, commitment: string): Promise<boolean> {
  return (await commitSeed(seed)) === commitment.toLowerCase();
}

/**
 * Deterministic PRNG (mulberry32) seeded from the hex seed.
 * Same seed → same sequence, which is what makes outcomes replayable.
 */
export function seededRandom(seed: string): () => number {
  let state = parseInt(seed.slice(0, 8), 16) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
