"use client";

import type { ReactNode } from "react";
import { Field, Input, Select, Ticket } from "@/components/ui";
import type { Bank } from "./api";

/** ACCOUNT NUMBER (big mono) + BANK select. `row` puts them side by side on desktop. */
export function BankFields({
  banks,
  account,
  onAccount,
  bank,
  onBank,
  bankLabel = "Bank",
  row = false,
}: {
  banks: Bank[] | null;
  account: string;
  onAccount: (v: string) => void;
  bank: string;
  onBank: (v: string) => void;
  bankLabel?: string;
  row?: boolean;
}) {
  return (
    <div className={row ? "flex flex-col gap-5 lg:grid lg:grid-cols-[1.2fr_1fr] lg:gap-5" : "flex flex-col gap-5"}>
      <Field label="Account number">
        <Input
          big
          mono
          inputMode="numeric"
          autoComplete="off"
          placeholder="0123456789"
          value={account}
          onChange={(e) => onAccount(e.target.value.replace(/\D/g, "").slice(0, 10))}
        />
      </Field>
      <Field label={bankLabel}>
        <Select value={bank} onChange={(e) => onBank(e.target.value)} disabled={!banks}>
          <option value="">{banks ? "Pick one" : "Loading banks…"}</option>
          {banks?.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

/** Black notched ticket: "✓ NAME FROM YOUR BANK" + the name in big yellow caps. */
export function NameTicket({
  label = "Name from your bank",
  name,
  stub,
  big = false,
}: {
  label?: string;
  name: string;
  stub?: ReactNode;
  big?: boolean;
}) {
  return (
    <Ticket tone="ink" stub={stub} bodyClassName="px-6 pt-5 pb-6 lg:px-8 lg:pt-7" stubClassName="px-6 py-4 lg:px-8">
      <p className="font-label text-green">✓ {label}</p>
      <p
        aria-live="polite"
        className={`font-display mt-2 break-words text-yellow ${big ? "text-[clamp(48px,14vw,64px)] lg:text-[96px]" : "text-[clamp(40px,12vw,52px)] lg:text-[72px]"}`}
      >
        {name}
      </p>
    </Ticket>
  );
}
