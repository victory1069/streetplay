import "server-only";
import { getPaymentsProvider } from "@/lib/payments";
import { appHost } from "@/lib/format";

/** Bank name for a code, from the payments partner's list. "Bank" if unknown. */
export async function bankNameFor(code: string | null | undefined): Promise<string> {
  if (!code) return "Bank";
  try {
    const banks = await getPaymentsProvider().listBanks();
    return banks.find((b) => b.code === code)?.name ?? "Bank";
  } catch {
    return "Bank";
  }
}

/** WhatsApp support when a support number is set, else email. */
export function supportHref(subject = "StreetPlay receipt"): string {
  const phone = process.env.SUPPORT_PHONE?.replace(/\D/g, "").replace(/^0/, "234");
  if (phone) return `https://wa.me/${phone}?text=${encodeURIComponent(subject)}`;
  return `mailto:support@${appHost()}?subject=${encodeURIComponent(subject)}`;
}
