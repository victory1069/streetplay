"use client";

import { useEffect, useState } from "react";
import { Arrow, Button, CodeBoxes, ErrorText, Headline, Label, PhoneColumn, PhoneInput } from "@/components/ui";
import { sendPhoneCode, verifyPhoneCode } from "@/lib/data/auth";
import { getStudioContext } from "@/lib/data/studio";
import { formatPhone } from "@/lib/format";
import { STEP_PATH, nextOnboardingStep } from "@/lib/onboarding";
import { errorMessage } from "./shared";

const RESEND_SECONDS = 30;

/** Step 1 of sign-in: the phone number. Calls onSent with the normalised number. */
export function PhoneForm({ onSent, cta = "GET STARTED" }: { onSent: (phone: string) => void; cta?: string }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          onSent(await sendPhoneCode(input));
        } catch (err) {
          setError(errorMessage(err));
          setBusy(false);
        }
      }}
    >
      <label className="block">
        <Label className="mb-2.5">Phone number</Label>
        <PhoneInput value={input} onChange={(e) => setInput(e.target.value)} placeholder="803 555 0142" aria-label="Phone number" autoFocus={false} />
      </label>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" loading={busy} disabled={input.replace(/\D/g, "").length < 10}>
        {cta} <Arrow />
      </Button>
    </form>
  );
}

/**
 * Step 2 of sign-in, as its own screen: the 6-digit code. Verifies as soon
 * as the sixth digit lands; resend unlocks after 30 seconds.
 */
export function CodeScreen({
  phone,
  tone = "yellow",
  onBack,
  onVerified,
}: {
  phone: string;
  tone?: "yellow" | "paper";
  onBack: () => void;
  onVerified: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  const verify = async (value: string) => {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyPhoneCode(phone, value);
      await onVerified();
    } catch (err) {
      setError(errorMessage(err));
      setCode("");
      setBusy(false);
    }
  };

  return (
    <main className={`${tone === "yellow" ? "theme-yellow" : "theme-paper"} flex flex-1 flex-col`}>
      <PhoneColumn className="px-7 pt-5 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <button type="button" onClick={onBack} aria-label="Change number" className="-ml-2 grid size-11 place-items-center text-[30px] leading-none">
          ←
        </button>
        <Headline className="mt-6 text-[clamp(56px,17vw,80px)] leading-[0.86]">Enter the code.</Headline>
        <p className="mt-4 text-[19px] leading-snug">
          We texted a 6-digit code to <span className="font-bold whitespace-nowrap">{formatPhone(phone)}</span>.
        </p>

        <form
          className="mt-10 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void verify(code);
          }}
        >
          <CodeBoxes
            value={code}
            onChange={(v) => {
              setCode(v);
              if (v.length === 6) void verify(v);
            }}
          />
          <div aria-live="polite">
            <ErrorText>{error}</ErrorText>
          </div>
        </form>

        <div className="mt-auto space-y-5 pt-10">
          <Button onClick={() => void verify(code)} loading={busy} disabled={code.length !== 6}>
            VERIFY <Arrow />
          </Button>
          <div className="flex items-center justify-between text-[17px] font-semibold">
            <button type="button" onClick={onBack} className="min-h-[44px] underline underline-offset-4">
              Wrong number?
            </button>
            {wait > 0 ? (
              <span className="font-mono text-[15px] opacity-70">Resend in 0:{String(wait).padStart(2, "0")}</span>
            ) : (
              <button
                type="button"
                className="min-h-[44px] underline underline-offset-4"
                onClick={async () => {
                  setError(null);
                  try {
                    await sendPhoneCode(phone);
                    setWait(RESEND_SECONDS);
                  } catch (err) {
                    setError(errorMessage(err));
                  }
                }}
              >
                Resend code
              </button>
            )}
          </div>
        </div>
      </PhoneColumn>
    </main>
  );
}

/** After sign-in: an explicit ?next= wins, otherwise the next onboarding step. */
export async function routeAfterSignIn(replace: (href: string) => void, next: string | null) {
  const ctx = await getStudioContext().catch(() => null);
  const step = nextOnboardingStep(ctx);
  if (next && step === "done") return replace(next);
  replace(STEP_PATH[step]);
}
