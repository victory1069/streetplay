import type { Kobo } from "@/types/domain";

export const naira = (amount: number): Kobo => Math.round(amount * 100);
export const toNaira = (kobo: Kobo): number => Math.floor(kobo / 100);

const formatter = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

/** ₦50,000 — whole naira, built for big on-camera type. */
export function formatNaira(kobo: Kobo): string {
  const sign = kobo < 0 ? "−" : "";
  return `${sign}₦${formatter.format(Math.abs(toNaira(kobo)))}`;
}

/** +₦500,000 / −₦20,000 for ledgers. */
export function formatSigned(kobo: Kobo): string {
  return kobo > 0 ? `+${formatNaira(kobo)}` : formatNaira(kobo);
}

/** ₦12.5k, ₦500k, ₦1.2m — for chips and cards. */
export function formatShort(kobo: Kobo): string {
  const n = toNaira(kobo);
  if (n >= 1_000_000) return `₦${trim(n / 1_000_000)}m`;
  if (n >= 1_000) return `₦${trim(n / 1_000)}k`;
  return `₦${n}`;
}

/** ₦50K — wheel slices. */
export function formatShortUpper(kobo: Kobo): string {
  return formatShort(kobo).toUpperCase();
}

function trim(x: number): string {
  return (Math.round(x * 10) / 10).toString();
}

/** Parse "500,000" / "₦500k" typed by a host into kobo. */
export function parseNairaInput(input: string): Kobo | null {
  const s = input.trim().toLowerCase().replace(/[₦,\s]/g, "");
  const m = s.match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  if (!m) return null;
  const mult = m[2] === "m" ? 1_000_000 : m[2] === "k" ? 1_000 : 1;
  return naira(parseFloat(m[1]) * mult);
}
