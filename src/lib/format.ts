// Display helpers shared by every screen: names, phones, accounts, receipts.

/** "OKORO ADAEZE NKECHI" + spoken "Adaeze" → "Adaeze O." for public receipts. */
export function recipientDisplay(participantName: string | null | undefined, accountName: string | null | undefined): string {
  const tokens = (accountName ?? "").trim().split(/\s+/).filter(Boolean);
  const first = participantName?.trim().split(/\s+/)[0];
  if (!tokens.length) return first ? titleCase(first) : "A winner";

  if (first) {
    const idx = tokens.findIndex((t) => t.toLowerCase() === first.toLowerCase());
    if (idx >= 0) {
      const other = idx === tokens.length - 1 ? tokens[0] : tokens[tokens.length - 1];
      return other && other !== tokens[idx] ? `${titleCase(tokens[idx])} ${other[0].toUpperCase()}.` : titleCase(tokens[idx]);
    }
    return `${titleCase(first)} ${tokens[0][0].toUpperCase()}.`;
  }
  return tokens.length > 1 ? `${titleCase(tokens[0])} ${tokens[tokens.length - 1][0].toUpperCase()}.` : titleCase(tokens[0]);
}

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase());
}

/** "0123456789" → "0123 •••• 89" */
export function maskAccount(acct: string | null | undefined): string {
  if (!acct) return "";
  return `${acct.slice(0, 4)} •••• ${acct.slice(-2)}`;
}

/** Nigerian numbers to E.164 digits without "+": "08035550142" → "2348035550142". Null if invalid. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("234")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  if (!/^[789]\d{9}$/.test(d)) return null;
  return `234${d}`;
}

/** "2348035550142" → "0803 555 0142" */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const d = e164.replace(/\D/g, "").replace(/^234/, "0");
  return d.length === 11 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : d;
}

/** "2348022214410" → "0802 ••• 4410" */
export function maskPhone(e164OrLast4: string | null | undefined): string {
  if (!e164OrLast4) return "";
  const d = e164OrLast4.replace(/\D/g, "");
  if (d.length <= 4) return `•••• ${d}`;
  const local = d.replace(/^234/, "0");
  return `${local.slice(0, 4)} ••• ${local.slice(-4)}`;
}

/** "7Q4K2R" → "SP-7Q4K-2R" */
export function receiptLabel(code: string): string {
  const c = code.toUpperCase();
  return `SP-${c.slice(0, 4)}-${c.slice(4)}`;
}

/** Short host for links read out on camera, e.g. "sp.ng". */
export function appHost(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").host;
  } catch {
    return "localhost:3000";
  }
}

export function appUrl(path = ""): string {
  return `${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
}

/** "15:47" in Lagos time. */
export function timeWAT(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
}

/** "7 Oct" or "7 Oct 2026" */
export function dateWAT(iso: string | Date | null | undefined, withYear = false): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "Africa/Lagos",
  });
}

/** "Today 3PM", "Tomorrow 10AM", "Sat 9:30AM" */
export function whenLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const fmt = (o: Intl.DateTimeFormatOptions) => d.toLocaleString("en-US", { ...o, timeZone: "Africa/Lagos" });
  const time = fmt({ hour: "numeric", minute: d.getMinutes() ? "2-digit" : undefined }).replace(" ", "");
  const day = (x: Date) => x.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos" });
  const tomorrow = new Date(now.getTime() + 86_400_000);
  if (day(d) === day(now)) return `Today ${time}`;
  if (day(d) === day(tomorrow)) return `Tomorrow ${time}`;
  return `${fmt({ weekday: "short" })} ${time}`;
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? "")).toUpperCase();
}

/** "0:07" */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
