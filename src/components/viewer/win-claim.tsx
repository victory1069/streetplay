"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Chip, ErrorText, Field, Headline, Logo, PhoneInput, TopBar } from "@/components/ui";
import { formatNaira } from "@/lib/money";
import { maskAccount, normalizePhone } from "@/lib/format";
import type { ClaimView } from "@/lib/server/views";
import { api, bankName, useBanks } from "@/components/participant/api";
import { BankFields, NameTicket } from "@/components/participant/bank-fields";

// /win/[code]/bank and /win/[code]/airtime: step 2 of 3 of a viewer prize.

function Shell({ view, children }: { view: ClaimView; children: ReactNode }) {
  const title = `Claim ${formatNaira(view.amount)}`;
  return (
    <main className="theme-paper flex flex-1 flex-col">
      <div className="lg:hidden">
        <TopBar title={title} back={`/win/${view.code}`} right="2 of 3" />
      </div>
      <header className="hidden items-center gap-8 border-b-[3px] border-ink px-9 py-5 lg:flex">
        <Link href={`/win/${view.code}`} aria-label="Back">
          <Logo />
        </Link>
        <h1 className="font-wide flex-1 text-[26px]">{title}</h1>
        <ol className="flex gap-2 font-mono text-[15px] font-semibold">
          <li className="bg-ink px-4 py-1.5 text-yellow">1 Prize ✓</li>
          <li className="bg-ink px-4 py-1.5 text-yellow" aria-current="step">
            2 Bank
          </li>
          <li className="border-2 border-ink px-4 py-1">3 Done</li>
        </ol>
      </header>
      {children}
    </main>
  );
}

function Consent({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Checkbox checked={checked} onChange={onChange}>
        I agree to the{" "}
        <button
          type="button"
          className="underline underline-offset-4"
          aria-expanded={open}
          onClick={(e) => {
            e.preventDefault();
            setOpen(!open);
          }}
        >
          prize terms
        </button>
        . My first name and initial go on the public receipt.
      </Checkbox>
      {open && (
        <p className="rounded-[12px] border-2 border-ink bg-card p-4 text-[15px] leading-snug">
          Free to play, no purchase needed. The prize is paid once, to the account or line you enter, if you claim within the time
          shown. Unclaimed prizes go back to the host. Receipts show your first name and initial only, never your account number.
        </p>
      )}
    </div>
  );
}

export function WinBank({ view }: { view: ClaimView }) {
  const router = useRouter();
  const banks = useBanks();
  const [phone, setPhone] = useState("");
  const [account, setAccount] = useState("");
  const [bank, setBank] = useState("");
  const [agree, setAgree] = useState(false);
  const [lookup, setLookup] = useState<{ key: string; name: string | null; error: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = account.length === 10 && bank ? `${account}:${bank}` : "";
  // Name check runs by itself once the number and bank are in.
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const [accountNumber, bankCode] = key.split(":");
    api<{ accountName: string }>(`/api/claim/${view.code}`, { check: true, accountNumber, bankCode })
      .then((r) => alive && setLookup({ key, name: r.accountName, error: null }))
      .catch((e: Error) => alive && setLookup({ key, name: null, error: e.message }));
    return () => {
      alive = false;
    };
  }, [key, view.code]);

  const current = key && lookup?.key === key ? lookup : null;
  const checking = Boolean(key) && !current;
  const phoneOk = normalizePhone(phone) !== null;
  const amount = formatNaira(view.amount);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const p = await api<{ receipt_code: string }>(`/api/claim/${view.code}`, { channel: "bank", accountNumber: account, bankCode: bank, phone });
      router.push(`/r/${p.receipt_code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Shell view={view}>
      <form
        className="mx-auto flex w-full max-w-[460px] flex-1 flex-col px-5 pt-6 pb-6 lg:grid lg:max-w-[1280px] lg:grid-cols-2 lg:gap-x-16 lg:px-14 lg:pt-12"
        onSubmit={(e) => {
          e.preventDefault();
          if (current?.name && agree && phoneOk) void claim();
        }}
      >
        <div className="flex flex-col gap-5">
          <Headline className="mb-2 hidden text-[96px] lg:block">WHERE SHOULD WE SEND IT?</Headline>
          <Field label="Phone number">
            <PhoneInput placeholder="803 412 7781" value={phone} onChange={(e) => setPhone(e.target.value.slice(0, 14))} />
          </Field>
          <BankFields row banks={banks} account={account} onAccount={setAccount} bank={bank} onBank={setBank} />
          <p className="hidden text-[17px] leading-snug opacity-70 lg:block">
            Banks, OPay, PalmPay, Moniepoint and Kuda all work. We never show your full account number.
          </p>
        </div>

        <div className="mt-6 flex flex-1 flex-col lg:mt-0 lg:justify-end">
          {checking && <p className="font-label sp-pulse">Checking the name…</p>}
          {current?.error && <ErrorText>{current.error}</ErrorText>}
          {current?.name && (
            <>
              <div className="lg:hidden">
                <NameTicket label="Account name" name={current.name} />
              </div>
              <div className="hidden lg:block">
                <NameTicket
                  big
                  name={current.name}
                  stub={
                    <div className="flex justify-between font-mono text-[17px]">
                      <span>
                        {bankName(banks, bank)} · {maskAccount(account)}
                      </span>
                      <span className="text-yellow">{amount}</span>
                    </div>
                  }
                />
              </div>
            </>
          )}
          <div className="mt-auto flex flex-col gap-5 pt-8 lg:mt-6 lg:pt-0">
            <Consent checked={agree} onChange={setAgree} />
            <ErrorText>{error}</ErrorText>
            <Button type="submit" loading={busy} disabled={!current?.name || !agree || !phoneOk}>
              CLAIM {amount}
            </Button>
          </div>
        </div>
      </form>
    </Shell>
  );
}

const NETWORKS = ["MTN", "Airtel", "Glo", "9mobile"];

export function WinAirtime({ view }: { view: ClaimView }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = formatNaira(view.amount);
  const ok = normalizePhone(phone) !== null && network && agree;

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const p = await api<{ receipt_code: string }>(`/api/claim/${view.code}`, { channel: "airtime", phone, network });
      router.push(`/r/${p.receipt_code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Shell view={view}>
      <form
        className="mx-auto flex w-full max-w-[460px] flex-1 flex-col gap-5 px-5 pt-6 pb-6 lg:max-w-[720px] lg:pt-12"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) void claim();
        }}
      >
        <Headline className="hidden text-[96px] lg:block">WHICH LINE SHOULD WE TOP UP?</Headline>
        <Field label="Phone number">
          <PhoneInput placeholder="803 412 7781" value={phone} onChange={(e) => setPhone(e.target.value.slice(0, 14))} />
        </Field>
        <div>
          <p className="font-label mb-2.5">Network</p>
          <div className="flex flex-wrap gap-2.5">
            {NETWORKS.map((n) => (
              <Chip key={n} selected={network === n} onClick={() => setNetwork(n)}>
                {n}
              </Chip>
            ))}
          </div>
        </div>
        <div className="mt-auto flex flex-col gap-5 pt-8">
          <Consent checked={agree} onChange={setAgree} />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" loading={busy} disabled={!ok}>
            CLAIM {amount} AIRTIME
          </Button>
        </div>
      </form>
    </Shell>
  );
}
