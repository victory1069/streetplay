"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Arrow, Button, CheckDot, ErrorText, Field, Headline, Logo, PhoneColumn } from "@/components/ui";
import { formatNaira } from "@/lib/money";
import { FORMATS } from "@/lib/games/formats";
import type { ParticipantView } from "@/lib/server/views";
import { api, bankName, useBanks } from "./api";
import { BankFields, NameTicket } from "./bank-fields";

// /p/[code]: the stranger who just won scans the host's QR, types their own
// account, confirms the bank's name, then waits for the host to send.

const firstName = (s: string | null | undefined) => (s ?? "").trim().split(/\s+/)[0] ?? "";

export function ParticipantFlow({ initial }: { initial: ParticipantView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const banks = useBanks();
  const [account, setAccount] = useState("");
  const [bank, setBank] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState<null | "check" | "yes" | "no">(null);
  const [error, setError] = useState<string | null>(null);

  // Poll for the host's side: confirmed → paid → sent.
  useEffect(() => {
    const t = window.setInterval(() => {
      api<ParticipantView>(`/api/p/${encodeURIComponent(view.code)}`)
        .then(setView)
        .catch(() => {});
    }, 3000);
    return () => window.clearInterval(t);
  }, [view.code]);

  const receipt = view.payout?.status === "sent" ? view.payout.receipt_code : null;
  useEffect(() => {
    if (receipt) router.replace(`/r/${receipt}`);
  }, [receipt, router]);

  const name = firstName(view.participant_name);
  const host = firstName(view.creator_name);
  const amount = view.amount != null ? formatNaira(view.amount) : null;
  const format = view.round_format ? FORMATS[view.round_format]?.name : null;
  const from = [view.creator_handle ? `@${view.creator_handle}` : view.creator_name, format].filter(Boolean).join(" · ");

  async function check() {
    setBusy("check");
    setError(null);
    try {
      setView(await api<ParticipantView>(`/api/p/${encodeURIComponent(view.code)}`, { accountNumber: account, bankCode: bank, phone }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function confirm(yes: boolean) {
    setBusy(yes ? "yes" : "no");
    setError(null);
    try {
      setView(await api<ParticipantView>(`/api/p/${encodeURIComponent(view.code)}/confirm`, { confirm: yes }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  let body: ReactNode;

  if (view.expired || view.status === "cancelled") {
    body = (
      <Message title="THIS LINK HAS EXPIRED.">
        Ask {host || "the host"} to show you a new QR code. Your prize isn&apos;t lost.
      </Message>
    );
  } else if (receipt) {
    body = <p className="font-label sp-pulse py-10">Opening your receipt…</p>;
  } else if (view.status === "waiting") {
    body = (
      <form
        className="flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void check();
        }}
      >
        <Logo className="self-start" />
        <p className="font-wide mt-8 text-[22px] leading-none">{name ? `${name}, you won` : "You won"}</p>
        {amount && <p className="font-display tabular text-[clamp(88px,30vw,136px)] leading-[0.82]">{amount}</p>}
        <p className="mt-1 text-[19px] opacity-70">from {from}</p>

        <div className="mt-8 flex flex-col gap-5">
          <BankFields banks={banks} account={account} onAccount={setAccount} bank={bank} onBank={setBank} />
          <p className="-mt-1 text-[17px] leading-snug opacity-70">Banks, OPay, PalmPay, Moniepoint and Kuda all work.</p>
          <Field label="Phone (for your SMS receipt)" hint="Optional">
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="0803 412 7781"
              value={phone}
              onChange={(e) => setPhone(e.target.value.slice(0, 16))}
              className="h-[52px] w-full rounded-[12px] border-2 border-ink bg-card px-4 text-[18px] font-semibold outline-none placeholder:font-normal placeholder:text-muted/60"
            />
          </Field>
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-8">
          <ErrorText>{error}</ErrorText>
          <Button type="submit" loading={busy === "check"} disabled={account.length !== 10 || !bank}>
            CHECK MY NAME <Arrow />
          </Button>
          <p className="text-center font-mono text-[14px] opacity-70">We never show your full account number</p>
        </div>
      </form>
    );
  } else if (view.status === "named") {
    body = (
      <div className="flex flex-1 flex-col">
        <Headline className="text-[clamp(56px,17vw,80px)]">IS THIS YOU?</Headline>
        <div className="mt-6">
          <NameTicket
            big
            name={view.account_name ?? ""}
            stub={
              <p className="font-mono text-[17px]">
                {bankName(banks, view.bank_code)} · {view.account_masked}
              </p>
            }
          />
        </div>
        <p className="mt-6 text-[19px] leading-snug">
          {host || "The host"} will see this name and read it out before sending.
        </p>
        <div className="mt-auto flex flex-col gap-3 pt-8">
          <ErrorText>{error}</ErrorText>
          <Button onClick={() => confirm(true)} loading={busy === "yes"} disabled={busy !== null}>
            YES, THAT&apos;S ME
          </Button>
          <Button variant="outline" font="bold" size="md" onClick={() => confirm(false)} loading={busy === "no"} disabled={busy !== null}>
            No, change details
          </Button>
        </div>
      </div>
    );
  } else {
    // confirmed, or paid but not sent yet.
    const p = view.payout;
    const waiting =
      p?.status === "sending"
        ? { title: "Sending now…", sub: "Lands in seconds" }
        : p?.status === "failed"
          ? { title: "The transfer didn't go through", sub: `${host || "The host"} will try again` }
          : { title: `Waiting for ${host || "the host"}…`, sub: "Sends automatically" };
    body = (
      <div className="flex flex-1 flex-col">
        <p className="font-wide text-[22px] leading-none">{name ? `${name}, your` : "Your"}</p>
        {amount && <p className="font-display tabular text-[clamp(80px,28vw,128px)] leading-[0.82]">{amount}</p>}
        <p className="font-display text-[clamp(44px,14vw,64px)]">IS LOCKED IN.</p>

        <ol className="mt-6 overflow-hidden rounded-[18px] border-[3px] border-ink bg-card" aria-live="polite">
          <Step dot={<CheckDot />} title="You won" sub={format ?? undefined} />
          <Step
            dot={<CheckDot />}
            title="Name checked"
            sub={`${(view.account_name ?? "").toUpperCase()} · ${bankName(banks, view.bank_code)}`}
          />
          <Step dot={<CheckDot tone="pending" />} title={waiting.title} sub={waiting.sub} highlight />
          <Step dot={<CheckDot tone="empty" />} title="In your account" muted last />
        </ol>

        <p className="mt-6 text-[19px] leading-snug">
          You don&apos;t need to do anything.{" "}
          {p?.phone_masked ? (
            <>
              We&apos;ll text <b>{p.phone_masked}</b> the moment it&apos;s sent.
            </>
          ) : (
            "Keep this page open to see it land."
          )}
        </p>
      </div>
    );
  }

  return (
    <main className="theme-paper flex flex-1 flex-col">
      <PhoneColumn className="px-5 pt-6 pb-6 lg:pt-12">{body}</PhoneColumn>
    </main>
  );
}

function Step({
  dot,
  title,
  sub,
  highlight = false,
  muted = false,
  last = false,
}: {
  dot: ReactNode;
  title: string;
  sub?: string;
  highlight?: boolean;
  muted?: boolean;
  last?: boolean;
}) {
  return (
    <li className={`flex items-center gap-5 px-5 py-4 ${last ? "" : "border-b-2 border-dashed border-ink"} ${highlight ? "bg-yellow" : ""}`}>
      {dot}
      <span className="min-w-0">
        <span className={`font-wide block text-[19px] leading-tight ${muted ? "text-muted" : ""}`}>{title}</span>
        {sub && <span className="mt-0.5 block font-mono text-[14px] opacity-80">{sub}</span>}
      </span>
    </li>
  );
}

export function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-5">
      <Logo className="self-start" />
      <Headline className="mt-6 text-[clamp(48px,14vw,72px)]">{title}</Headline>
      <p className="text-[19px] leading-snug">{children}</p>
    </div>
  );
}
