"use client";

import { useState } from "react";
import { Arrow, Button, ErrorText, Field, Input } from "@/components/ui";
import { formatNaira, parseNairaInput } from "@/lib/money";

export function FundForm({ code }: { code: string }) {
  const [amount, setAmount] = useState("");
  const [brand, setBrand] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kobo = parseNairaInput(amount);
  const ok = Boolean(kobo && kobo >= 1_000_00 && brand.trim() && email.includes("@"));

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok || !kobo) return;
        setBusy(true);
        setError(null);
        try {
          const res = await fetch(`/api/fund/${encodeURIComponent(code)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: kobo, sponsorName: brand.trim(), email: email.trim() }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.message ?? "Couldn't start the payment. Try again.");
          window.location.assign(data.url);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Couldn't start the payment.");
          setBusy(false);
        }
      }}
    >
      <Field label="Amount" hint="Minimum ₦1,000. Every naira goes to the prize pool." error={amount && !kobo ? "Enter an amount like 250,000 or 250k." : null}>
        <Input big mono inputMode="decimal" placeholder="₦250,000" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Brand name" hint="Shown on the receipts as “Prize pool by …”.">
        <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Your brand" maxLength={60} autoComplete="organization" />
      </Field>
      <Field label="Email for the receipt">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@brand.com" autoComplete="email" />
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" variant="ink" loading={busy} disabled={!ok}>
        Pay {kobo ? formatNaira(kobo) : ""} <Arrow />
      </Button>
    </form>
  );
}
