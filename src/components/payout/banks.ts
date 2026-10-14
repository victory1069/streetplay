import { POPULAR_BANK_CODES } from "@/lib/data/payouts";
import type { Bank } from "@/lib/payments/types";

// Short names that fit on chips and receipts ("GTBank", not "Guaranty Trust Bank").
const SHORT: Record<string, string> = {
  "058": "GTBank",
  "999992": "OPay",
  "044": "Access",
  "50515": "Moniepoint",
  "50211": "Kuda",
  "999991": "PalmPay",
  "057": "Zenith",
  "011": "First Bank",
  "033": "UBA",
};

export const POPULAR = POPULAR_BANK_CODES;

export function shortBank(banks: Bank[], code: string | null | undefined): string {
  if (!code) return "Bank";
  return SHORT[code] ?? banks.find((b) => b.code === code)?.name ?? "Bank";
}
