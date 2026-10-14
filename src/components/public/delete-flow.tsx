"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, CodeBoxes, ErrorText, Input, Label } from "@/components/ui";

type Step = { kind: "start" } | { kind: "sms"; phone: string } | { kind: "account" } | { kind: "done" };

async function post(code: string, body: unknown): Promise<{ method?: "sms" | "account"; phone?: string; deleted?: boolean }> {
  const res = await fetch(`/api/r/${encodeURIComponent(code)}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? "Something went wrong. Try again.");
  return data;
}

export function DeleteFlow({ receiptCode, alreadyDeleted }: { receiptCode: string; alreadyDeleted: boolean }) {
  const [step, setStep] = useState<Step>(alreadyDeleted ? { kind: "done" } : { kind: "start" });
  const [code, setCode] = useState("");
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await post(receiptCode, { action: "request" });
      if (r.deleted) setStep({ kind: "done" });
      else if (r.method === "sms") setStep({ kind: "sms", phone: r.phone ?? "your phone" });
      else setStep({ kind: "account" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await post(receiptCode, step.kind === "sms" ? { action: "confirm", code } : { action: "confirm", accountNumber: account });
      setStep({ kind: "done" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (step.kind === "done")
    return (
      <div className="space-y-4" aria-live="polite">
        <p className="font-display text-[clamp(40px,12vw,56px)]">Done. Your details are gone.</p>
        <p className="text-[18px] leading-snug">The public receipt now says &quot;Paid to a winner&quot;.</p>
        <Link href={`/r/${receiptCode}`} className="inline-flex min-h-[44px] items-center font-mono text-[15px] underline underline-offset-4">
          Back to the receipt
        </Link>
      </div>
    );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (step.kind === "start") void request();
        else void confirm();
      }}
    >
      {step.kind === "sms" && (
        <div>
          <Label className="mb-2.5">Enter the code we texted to {step.phone}</Label>
          <CodeBoxes value={code} onChange={setCode} length={4} />
          <button type="button" onClick={() => void request()} className="mt-2 min-h-[44px] font-mono text-[14px] underline underline-offset-4">
            Send a new code
          </button>
        </div>
      )}
      {step.kind === "account" && (
        <label className="block">
          <Label className="mb-2.5">Confirm with the 10-digit account number we paid</Label>
          <Input
            mono
            big
            inputMode="numeric"
            autoComplete="off"
            value={account}
            onChange={(e) => setAccount(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="0123456789"
          />
        </label>
      )}
      {step.kind === "start" && <p className="text-[16px] text-muted">We&apos;ll check it&apos;s you first: by a code to your phone, or your account number.</p>}
      <ErrorText>{error}</ErrorText>
      <Button
        type="submit"
        variant="red"
        loading={busy}
        disabled={(step.kind === "sms" && code.length !== 4) || (step.kind === "account" && account.length !== 10)}
      >
        Delete my details
      </Button>
    </form>
  );
}
