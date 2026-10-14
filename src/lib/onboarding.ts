// The onboarding sequence, in one place.
//
//   phone → code → 1 Your show (name, handle) → 2 Open your wallet (KYC)
//   → 3 Fund your wallet (skippable) → Home (setup checklist until the
//   first episode is planned)
//
// One account is one show. Anyone who leaves midway resumes at their step.

import type { StudioContext } from "@/lib/data/studio";

export type OnboardingStep = "show" | "wallet" | "fund" | "done";

export const ONBOARDING_STEPS = [
  { id: "show", label: "Your show" },
  { id: "wallet", label: "Wallet" },
  { id: "fund", label: "Fund" },
] as const;

export const STEP_PATH: Record<OnboardingStep, string> = {
  show: "/studio/welcome",
  wallet: "/studio/kyc",
  fund: "/studio/wallet/fund?setup=1",
  done: "/studio",
};

/** Where this person should be next. Funding is offered once, after the wallet, never forced. */
export function nextOnboardingStep(ctx: StudioContext | null): OnboardingStep {
  if (!ctx) return "show";
  const c = ctx.creator;
  const walletSubmitted = c.kyc_status === "verified" || (c.kyc_status === "pending" && Boolean(c.kyc_submitted_at));
  if (!walletSubmitted) return "wallet";
  return "done";
}
