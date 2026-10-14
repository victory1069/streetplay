"use client";

import { useState } from "react";
import { Arrow, Button, ButtonLink, buttonClass, Caption, ErrorText, Headline, Input, Label, PhoneColumn, PhoneInput, Shout, Ticket } from "@/components/ui";
import { HoldButton, Keypad, Sheet } from "@/components/ui/interactive";
import { Qr } from "@/components/ui/qr";
import { nameEnquiry } from "@/lib/data/payouts";
import { appHost, appUrl, maskAccount, maskPhone, normalizePhone, receiptLabel, timeWAT } from "@/lib/format";
import { formatNaira } from "@/lib/money";
import type { AccountRequest, Kobo, Payout } from "@/types/domain";
import type { Bank } from "@/lib/payments/types";
import { POPULAR, shortBank } from "./banks";

export interface Named {
  source: "qr" | "keypad";
  accountName: string;
  accountNumber: string;
  bankCode: string;
  token?: string;
}

const safeBottom = "pb-[calc(env(safe-area-inset-bottom)+20px)]";

function Dark({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <main className="theme-ink flex flex-1 flex-col">
      <PhoneColumn className={`px-7 pt-6 ${safeBottom} ${className}`}>{children}</PhoneColumn>
    </main>
  );
}

const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

// ---------------------------------------------------------------- a. QR

export function QrStep({
  amount,
  name,
  req,
  onType,
  onBankless,
}: {
  amount: Kobo;
  name: string;
  req: AccountRequest | null;
  onType: () => void;
  onBankless: () => void;
}) {
  const first = name.split(/\s+/)[0];
  return (
    <Dark>
      <Caption className="text-[13px] text-yellow">
        {first} won {formatNaira(amount)}
      </Caption>
      <Headline className="mt-4 text-[clamp(56px,18vw,80px)]">Scan with your camera</Headline>
      <div className="mx-auto mt-6 grid aspect-square w-[min(240px,70vw)] place-items-center rounded-[16px] bg-white p-4">
        {req ? <Qr value={appUrl(`/p/${req.code}`)} className="size-full" /> : <span className="font-label sp-pulse text-ink">Making code…</span>}
      </div>
      {req && <p className="mt-4 text-center font-mono text-[16px] text-paper/80">or open {appHost()}/p/{req.code}</p>}

      <div className="mt-auto pt-8">
        <p className="mb-4 flex items-center justify-center gap-3 text-[16px] text-paper/85" aria-live="polite">
          <span className="sp-pulse size-3 rounded-full bg-yellow" />
          {req?.status === "named" ? "Checking name…" : `Waiting for ${first}'s phone…`}
        </p>
        <Button variant="outline-light" font="bold" size="lg" onClick={onType} className="min-h-[56px]">
          Type it for them instead
        </Button>
        <button type="button" onClick={onBankless} className="font-wide mt-4 min-h-[44px] w-full text-[16px] underline underline-offset-4">
          No bank account?
        </button>
      </div>
    </Dark>
  );
}

// ---------------------------------------------------------------- b. Keypad

function groupDigits(d: string) {
  return [d.slice(0, 4), d.slice(4, 8), d.slice(8, 10)].filter(Boolean).join(" ");
}

export function KeypadStep({
  amount,
  roundLabel,
  banks,
  offline,
  onShowQr,
  onNamed,
  onQueue,
  caution,
}: {
  amount: Kobo;
  roundLabel: string;
  banks: Bank[];
  offline: boolean;
  /** Only used offline, where the name step is skipped. */
  caution: Caution;
  onShowQr: () => void;
  onNamed: (n: Named) => void;
  onQueue: (accountNumber: string, bankCode: string) => Promise<void>;
}) {
  const [digits, setDigits] = useState("");
  const [bank, setBank] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = digits.length === 10 && !!bank;

  const check = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (offline) {
        await onQueue(digits, bank!);
        return;
      }
      const r = await nameEnquiry(digits, bank!);
      onNamed({ source: "keypad", accountName: r.accountName, accountNumber: digits, bankCode: bank! });
    } catch (e) {
      setError(errMsg(e, "Couldn't check that account."));
      setBusy(false);
    }
  };

  const chips = [...POPULAR, ...(bank && !POPULAR.includes(bank) ? [bank] : [])];
  const filtered = banks.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Dark className="pt-5">
      <div className="flex items-center justify-between font-label text-[13px]">
        <span className="text-paper/80">Pay winner{roundLabel ? ` · ${roundLabel}` : ""}</span>
        <span className="font-mono text-[16px] font-semibold tracking-normal text-yellow">{formatNaira(amount)}</span>
      </div>
      <p className="mt-5 min-h-[56px] border-b-[3px] border-yellow pb-2 font-mono text-[clamp(32px,10.5vw,44px)] leading-none font-medium tabular" aria-live="polite" aria-label={`Account number ${digits}`}>
        {groupDigits(digits)}
        {digits.length < 10 && <span className="sp-pulse ml-1 inline-block h-[0.12em] w-[0.6em] bg-smoke align-baseline" />}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {chips.map((code) => {
          const on = bank === code;
          return (
            <button
              key={code}
              type="button"
              aria-pressed={on}
              onClick={() => setBank(code)}
              className={`font-wide inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[15px] ${on ? "bg-yellow text-ink" : "border-2 border-smoke text-paper"}`}
            >
              {on && <span aria-hidden>✓</span>}
              {shortBank(banks, code)}
            </button>
          );
        })}
        <button type="button" onClick={() => setMore(true)} className="font-wide inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 border-smoke px-4 text-[15px]">
          More <span className="text-[10px]">▼</span>
        </button>
      </div>

      <div className="mt-auto pt-6">
        {offline && <p className="mb-3 text-center font-mono text-[13px] text-red">No signal: name will be checked when it sends</p>}
        {offline && caution.reasons.length > 0 && <p className="mb-3 text-center font-mono text-[13px] text-yellow">This is a big one: {caution.reasons.join(" ")}</p>}
        <ErrorText>{error}</ErrorText>
        <div className="mt-2">
          <Keypad
            onKey={(d) => setDigits((cur) => (cur.length < 10 ? cur + d : cur))}
            onDelete={() => setDigits((cur) => cur.slice(0, -1))}
            onDone={check}
            doneDisabled={!ready}
          />
        </div>
        <div className="mt-3 flex gap-2.5">
          <Button variant="outline-light" font="bold" size="md" className="flex-1" onClick={onShowQr}>
            Show QR
          </Button>
          {offline && caution.reasons.length > 0 ? (
            <HoldButton
              onComplete={check}
              ms={1500}
              disabled={!ready || busy}
              fillClassName="bg-ink/30"
              className={buttonClass({ variant: "yellow", size: "md", className: "flex-[1.4] text-[24px] disabled:bg-smoke disabled:text-paper/50 disabled:opacity-100" })}
            >
              Hold to queue {formatNaira(amount)}
            </HoldButton>
          ) : (
            <Button variant="yellow" size="md" className="flex-[1.4] text-[28px] disabled:bg-smoke disabled:text-paper/50 disabled:opacity-100" disabled={!ready} loading={busy} onClick={check}>
              {offline ? `Queue ${formatNaira(amount)}` : "Check name"}
            </Button>
          )}
        </div>
      </div>

      <Sheet open={more} onClose={() => setMore(false)}>
        <Label className="mb-2">Find their bank</Label>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a bank name" autoFocus aria-label="Search banks" />
        <ul className="mt-3 max-h-[50vh] overflow-y-auto">
          {filtered.map((b) => (
            <li key={b.code}>
              <button
                type="button"
                onClick={() => {
                  setBank(b.code);
                  setMore(false);
                  setQuery("");
                }}
                className="flex min-h-[52px] w-full items-center justify-between border-b-2 border-ink/15 text-left text-[18px] font-bold"
              >
                {b.name}
                {bank === b.code && <span aria-hidden>✓</span>}
              </button>
            </li>
          ))}
          {!filtered.length && <li className="py-4 text-[16px] text-muted">{banks.length ? "No bank matches." : "Bank list needs signal once. Try again when online."}</li>}
        </ul>
      </Sheet>
    </Dark>
  );
}

// ---------------------------------------------------------------- c. Name

export function NameStep({
  named,
  banks,
  amount,
  roundLabel,
  caution,
  onReEnter,
  onSend,
}: {
  named: Named;
  banks: Bank[];
  amount: Kobo;
  roundLabel: string;
  caution: Caution;
  onReEnter: () => void;
  onSend: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    if (busy || caution.blocked) return;
    setBusy(true);
    setError(null);
    try {
      await onSend();
    } catch (e) {
      setError(errMsg(e, "Couldn't queue the payout."));
      setBusy(false);
    }
  };
  return (
    <Dark className="pt-5">
      <Caption className="text-[13px] text-paper/80">Pay winner{roundLabel ? ` · ${roundLabel}` : ""}</Caption>
      <Ticket
        tone="yellow"
        className="mt-9"
        bodyClassName="px-5 pt-5 pb-10"
        stub={
          <p className="font-mono text-[16px] font-semibold">
            {shortBank(banks, named.bankCode)}
            {named.accountNumber ? ` · ${maskAccount(named.accountNumber)}` : ""}
          </p>
        }
        stubClassName="px-5 py-3"
      >
        <p className="font-label text-[13px] font-semibold text-green-text">✓ Account name</p>
        <p className="font-display mt-2 text-[clamp(52px,17vw,76px)] break-words">{named.accountName}</p>
      </Ticket>
      <p className="mt-4 text-center text-[16px] text-paper/85">
        Read the name out. Wrong person?{" "}
        <button type="button" onClick={onReEnter} className="text-paper underline underline-offset-4">
          Re-enter
        </button>
      </p>

      <div className="mt-auto pt-8">
        <div className="flex items-end justify-between border-t-2 border-smoke pt-3">
          <Label className="mb-2 text-paper/80">Amount</Label>
          <p className="font-display tabular text-[clamp(52px,17vw,72px)] text-yellow">{formatNaira(amount)}</p>
        </div>
        <CautionNote caution={caution} />
        <ErrorText>{error}</ErrorText>
        <SendButton caution={caution} busy={busy} onSend={send} className="mt-3 min-h-[76px] text-[36px]">
          {formatNaira(amount)}
        </SendButton>
      </div>
    </Dark>
  );
}

/**
 * Why a payout needs a deliberate press: above the hold-to-send limit, or the
 * account has won on this show before. `blocked` means the server would refuse.
 */
export interface Caution {
  reasons: string[];
  blocked: string | null;
}

export const NO_CAUTION: Caution = { reasons: [], blocked: null };

function CautionNote({ caution }: { caution: Caution }) {
  if (caution.blocked)
    return (
      <div role="alert" className="mt-4 rounded-[14px] border-2 border-red p-4">
        <p className="font-wide text-[20px] text-red">Can&apos;t pay this account</p>
        <p className="mt-1 text-[16px] leading-snug text-paper/85">{caution.blocked}</p>
      </div>
    );
  if (!caution.reasons.length) return null;
  return (
    <div role="alert" className="mt-4 rounded-[14px] border-2 border-yellow p-4">
      <p className="font-wide text-[20px] text-yellow">This is a big one</p>
      <ul className="mt-1 space-y-1 text-[16px] leading-snug text-paper/85">
        {caution.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

/** Tap to send normally; press and hold for 1.5s when there's a reason to slow down. */
function SendButton({
  caution,
  busy,
  onSend,
  className,
  children,
}: {
  caution: Caution;
  busy: boolean;
  onSend: () => void;
  className: string;
  children: React.ReactNode;
}) {
  if (caution.blocked)
    return (
      <Button variant="yellow" disabled className={`${className} disabled:bg-smoke disabled:text-paper/50 disabled:opacity-100`}>
        Send {children}
      </Button>
    );
  if (!caution.reasons.length)
    return (
      <Button variant="yellow" loading={busy} onClick={onSend} className={className}>
        Send {children} <Arrow />
      </Button>
    );
  return (
    <HoldButton onComplete={onSend} ms={1500} disabled={busy} fillClassName="bg-ink/30" className={buttonClass({ variant: "yellow", className })}>
      {busy ? "Sending…" : <>Hold to send {children}</>}
    </HoldButton>
  );
}

// ---------------------------------------------------------------- after send

export function SendingStep({ amount, name }: { amount: Kobo; name: string }) {
  return (
    <Dark>
      <Caption className="text-[13px] text-yellow">To {name}</Caption>
      <Headline className="mt-4 text-[clamp(56px,18vw,80px)]">Sending {formatNaira(amount)}…</Headline>
      <p className="mt-6 flex items-center gap-3 text-[17px] text-paper/85" aria-live="polite">
        <span className="sp-pulse size-3 rounded-full bg-yellow" />
        Talking to the bank. Keep the camera rolling.
      </p>
      <p className="mt-auto pt-8 text-center font-mono text-[13px] text-paper/70">Each payout is sent once, even if retried</p>
    </Dark>
  );
}

export function FailedStep({
  title,
  message,
  onRetry,
  onReEnter,
  consoleHref,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
  onReEnter: () => void;
  consoleHref: string;
}) {
  return (
    <Dark>
      <Caption className="text-[13px] text-red">Payout stopped</Caption>
      <Headline className="mt-4 text-[clamp(60px,20vw,90px)]">{title}</Headline>
      <p role="alert" className="mt-5 text-[18px] text-paper/90">
        {message}
      </p>
      <div className="mt-auto flex flex-col gap-3 pt-8">
        {onRetry && (
          <Button variant="yellow" onClick={onRetry} className="min-h-[68px]">
            Try again
          </Button>
        )}
        <Button variant="outline-light" font="bold" onClick={onReEnter} className="min-h-[56px]">
          Re-enter details
        </Button>
        <ButtonLink href={consoleHref} variant="ghost" font="bold" size="sm">
          Back to console
        </ButtonLink>
      </div>
    </Dark>
  );
}

// ---------------------------------------------------------------- d. Sent

export function SentStep({ payout, consoleHref }: { payout: Payout; consoleHref: string }) {
  const [qr, setQr] = useState(false);
  const url = appUrl(`/r/${payout.receipt_code}`);
  return (
    <main className="theme-yellow flex flex-1 flex-col overflow-x-hidden">
      <PhoneColumn className={`px-7 pt-10 ${safeBottom}`}>
        <Shout className="text-[clamp(54px,17vw,76px)]">E don land!</Shout>
        <p className="font-display tabular -mr-7 mt-3 overflow-hidden text-[clamp(120px,41vw,180px)] leading-[0.82] whitespace-nowrap" aria-live="polite">
          {formatNaira(payout.amount)}
        </p>
        <p className="font-wide mt-3 text-[24px]">to {payout.recipient_display ?? "the winner"}</p>

        <div className="mt-auto pt-10">
          <Ticket
            tone="ink"
            bodyClassName="flex items-end justify-between gap-3 px-5 pt-5 pb-4"
            stub={
              <div className="flex justify-between font-mono text-[15px]">
                <span className="text-paper/75">Verify</span>
                <span>
                  {appHost()}/r/{payout.receipt_code}
                </span>
              </div>
            }
            stubClassName="px-5 py-3.5"
          >
            <div>
              <p className="font-label text-[12px] text-paper/75">Receipt</p>
              <p className="mt-1 font-mono text-[19px] font-semibold text-yellow">{receiptLabel(payout.receipt_code)}</p>
            </div>
            <p className="font-mono text-[16px]">{timeWAT(payout.sent_at ?? payout.created_at)} WAT</p>
          </Ticket>
          <div className="mt-3 flex gap-2.5">
            <Button variant="outline" font="bold" size="md" className="flex-1" onClick={() => setQr(true)}>
              Show QR
            </Button>
            <ButtonLink href={consoleHref} variant="ink" size="md" className="flex-[1.3] text-[30px]">
              Next round <Arrow />
            </ButtonLink>
          </div>
        </div>
      </PhoneColumn>
      <Sheet open={qr} onClose={() => setQr(false)}>
        <p className="font-label text-[12px]">Receipt {receiptLabel(payout.receipt_code)}</p>
        <div className="mx-auto mt-4 aspect-square w-[min(260px,70vw)] rounded-[14px] bg-white p-4">
          <Qr value={url} className="size-full" />
        </div>
        <p className="mt-3 text-center font-mono text-[15px]">
          {appHost()}/r/{payout.receipt_code}
        </p>
        <Button variant="ink" size="md" className="mt-5" onClick={() => setQr(false)}>
          Done
        </Button>
      </Sheet>
    </main>
  );
}

// ---------------------------------------------------------------- f. Bankless

export function BanklessStep({
  amount,
  name,
  consoleHref,
  onSend,
  onBack,
  done,
}: {
  amount: Kobo;
  name: string;
  consoleHref: string;
  onSend: (phone: string) => Promise<void> | void;
  onBack?: () => void;
  done?: { phone: string };
}) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const e164 = normalizePhone(phone);
    if (!e164) {
      setError("Enter a valid Nigerian phone number.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSend(e164);
    } catch (e) {
      setError(errMsg(e, "Couldn't hold the prize."));
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Dark>
        <Caption className="text-[13px] text-yellow">
          {name} won {formatNaira(amount)}
        </Caption>
        <Headline className="mt-4 text-[clamp(56px,18vw,80px)]">Held. Code sent.</Headline>
        <p className="mt-5 text-[19px] text-paper/90" aria-live="polite">
          Code sent to {maskPhone(done.phone)}. They have 7 days.
        </p>
        <div className="mt-auto pt-8">
          <ButtonLink href={consoleHref} variant="yellow" className="min-h-[72px] text-[34px]">
            Next round <Arrow />
          </ButtonLink>
        </div>
      </Dark>
    );
  }

  return (
    <Dark>
      <div className="flex items-center justify-between gap-3">
        <Caption className="text-[13px] text-yellow">
          {name} won {formatNaira(amount)}
        </Caption>
        {onBack && (
          <button type="button" onClick={onBack} className="font-wide min-h-[44px] text-[15px] underline underline-offset-4">
            Back
          </button>
        )}
      </div>
      <Headline className="mt-4 text-[clamp(56px,18vw,80px)]">No account? We&apos;ll hold it.</Headline>
      <p className="mt-4 text-[18px] leading-[1.45] text-paper/85">
        We&apos;ll text a claim code to their phone. They can open any account (OPay, PalmPay or a bank) and claim within 7 days.
      </p>
      <label className="mt-6 block">
        <Label className="mb-2.5 text-paper/80">Their phone number</Label>
        <PhoneInput tone="dark" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="806 221 9034" />
      </label>
      <div className="mt-auto pt-8">
        <div className="flex items-center justify-between rounded-[14px] border-2 border-dashed border-yellow bg-coal px-5 py-4">
          <span className="font-mono text-[14px] text-paper/85">Held from budget</span>
          <span className="font-display tabular text-[44px] text-yellow">{formatNaira(amount)}</span>
        </div>
        <ErrorText>{error}</ErrorText>
        <Button variant="yellow" loading={busy} onClick={submit} className="mt-3 min-h-[72px] text-[34px]">
          Text claim code
        </Button>
      </div>
    </Dark>
  );
}
