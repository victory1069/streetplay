"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Arrow, ButtonLink, Headline, PhoneColumn, Spinner } from "@/components/ui";
import { useStudio } from "@/components/studio/studio-context";
import { getEpisode, getRound } from "@/lib/data/episodes";
import { createAccountRequest, getAccountRequest, getPayoutByKey, listBanks, previousWins, subscribeToAccountRequest, subscribeToPayouts } from "@/lib/data/payouts";
import { enqueuePayout, onOutboxChange, outboxItem, outboxItems, type OutboxItem } from "@/lib/offline/outbox";
import { recipientDisplay } from "@/lib/format";
import { formatNaira } from "@/lib/money";
import type { AccountRequest, Episode, Payout, PayoutDraft, Round } from "@/types/domain";
import type { Bank } from "@/lib/payments/types";
import { shortBank } from "./banks";
import { useNoSignal } from "./offline-strip";
import { QueuedScreen } from "./queued-screen";
import { BanklessStep, FailedStep, KeypadStep, NameStep, QrStep, SendingStep, SentStep, type Caution, type Named } from "./payout-steps";

type Step = "qr" | "keypad" | "name" | "bankless" | "sending";

/** QR or keypad → name check → send → filmable confirmation. Money only moves through the outbox. */
export function PayoutFlow({ episodeId, roundId }: { episodeId: string; roundId: string }) {
  const search = useSearchParams();
  const amount = Math.max(0, Math.round(Number(search.get("amount")) || 0));
  const studio = useStudio();
  const offline = useNoSignal();

  const [round, setRound] = useState<Round | null>(null);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [wins, setWins] = useState<{ account: string; count: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState<Step>("qr");
  const [req, setReq] = useState<AccountRequest | null>(null);
  const [named, setNamed] = useState<Named | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [item, setItem] = useState<OutboxItem | null>(null);
  const [live, setLive] = useState<Payout | null>(null);
  const creating = useRef(false);
  // Synchronous lock: a double tap on SEND must never queue two payouts
  // (each would get its own idempotency key and both would be paid).
  const sendLock = useRef(false);

  const name = round?.participant_name?.trim() || "The winner";
  const consoleHref = `/studio/episodes/${episodeId}`;

  // ---- load round, banks, any payout already queued for this round
  const creatorId = studio?.creator.id;
  useEffect(() => {
    if (!creatorId) return;
    let alive = true;
    (async () => {
      const [r, ep, b, existing] = await Promise.all([
        getRound(roundId).catch(() => null),
        getEpisode(episodeId).catch(() => null),
        listBanks().catch(() => [] as Bank[]),
        outboxItems().catch(() => [] as OutboxItem[]),
      ]);
      if (!alive) return;
      setRound(r);
      setEpisode(ep);
      setBanks(b);
      const mine = existing.find((i) => i.draft.round_id === roundId && i.state !== "failed");
      if (mine) {
        setItemId(mine.id);
        setItem(mine);
        setStep("sending");
      }
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [creatorId, episodeId, roundId]);

  // ---- QR handoff
  const participantName = round?.participant_name ?? null;
  const createRequest = useCallback(async () => {
    if (creating.current) return;
    creating.current = true;
    try {
      setReq(await createAccountRequest({ episodeId, roundId, amount, participantName }));
    } catch {
      setStep((s) => (s === "qr" ? "keypad" : s)); // offline: type it instead
    } finally {
      creating.current = false;
    }
  }, [episodeId, roundId, amount, participantName]);

  useEffect(() => {
    if (!loaded || step !== "qr" || req) return;
    const t = window.setTimeout(() => void createRequest(), 0);
    return () => window.clearTimeout(t);
  }, [loaded, step, req, createRequest]);

  const token = req?.token;
  useEffect(() => {
    if (!token || step !== "qr") return;
    const off = subscribeToAccountRequest(token, setReq);
    const poll = window.setInterval(() => void getAccountRequest(token).then((r) => r && setReq(r)).catch(() => {}), 4000);
    return () => {
      off();
      window.clearInterval(poll);
    };
  }, [token, step]);

  // ---- watch the outbox item and the payout row
  useEffect(() => {
    if (!itemId) return;
    let alive = true;
    const load = () =>
      void outboxItem(itemId)
        .then((i) => alive && i && setItem(i))
        .catch(() => {});
    // The server's row is the truth: Realtime only delivers future changes,
    // so after a reload (or a missed event) fetch it, and keep checking
    // until it's final.
    const refresh = () =>
      void getPayoutByKey(itemId)
        .then((p) => alive && p && setLive(p))
        .catch(() => {});
    load();
    refresh();
    const poll = window.setInterval(refresh, 5000);
    const off = onOutboxChange(load);
    const offPay = subscribeToPayouts(episodeId, (p) => {
      if (p.idempotency_key === itemId) setLive(p);
    });
    return () => {
      alive = false;
      window.clearInterval(poll);
      off();
      offPay();
    };
  }, [itemId, episodeId]);

  // ---- repeat winner? Checked once the account is named.
  const qrAccount = step === "qr" && req?.status === "confirmed" ? (req.account_number ?? null) : null;
  const namedAccount = qrAccount ?? (step === "name" ? (named?.accountNumber ?? null) : null);
  useEffect(() => {
    if (!creatorId || !namedAccount) return;
    let alive = true;
    previousWins(creatorId, namedAccount)
      .then((count) => alive && setWins({ account: namedAccount, count }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [creatorId, namedAccount]);

  const send = async (draft: Omit<PayoutDraft, "idempotency_key">, label: OutboxItem["label"]) => {
    if (sendLock.current) return;
    sendLock.current = true;
    try {
      const queued = await enqueuePayout(draft, label);
      setLive(null);
      setItem(queued);
      setItemId(queued.id);
      setStep("sending");
    } finally {
      sendLock.current = false;
    }
  };

  const base = { episode_id: episodeId, round_id: roundId, amount, participant_name: round?.participant_name ?? undefined };

  if (!studio || !loaded) {
    return (
      <main className="theme-ink flex flex-1 flex-col">
        <Spinner />
      </main>
    );
  }
  if (!amount) {
    return (
      <main className="theme-ink flex flex-1 flex-col">
        <PhoneColumn className="gap-6 px-7 py-10">
          <Headline className="text-[48px]">No prize to pay.</Headline>
          <ButtonLink href={consoleHref} variant="yellow">
            Back to console <Arrow />
          </ButtonLink>
        </PhoneColumn>
      </main>
    );
  }

  const roundLabel = round?.number ? `R${round.number}` : "";

  // Above the limit, or a repeat winner: the host presses and holds SEND.
  const limit = episode?.confirm_above ?? studio.creator.confirm_above;
  const above = limit > 0 && amount > limit ? [`It's above your ${formatNaira(limit)} hold-to-send limit.`] : [];
  const caution = (account: string | null): Caution => {
    const count = account && wins?.account === account ? wins.count : 0;
    if (count === 0) return { reasons: above, blocked: null };
    const times = count === 1 ? "once" : `${count} times`;
    if (episode?.repeat_policy === "block" || !studio.creator.allow_repeat_winners)
      return { reasons: [], blocked: `This account has already won on your show ${times}. Repeat winners are blocked in your settings.` };
    return { reasons: [...above, `This account has already won on your show ${times}.`], blocked: null };
  };

  // ---- after send
  if (step === "sending" && item) {
    const p = live ?? item.payout ?? null;
    const reEnter = () => {
      setItemId(null);
      setItem(null);
      setLive(null);
      setNamed(null);
      setStep("keypad");
    };
    if (p?.status === "sent") return <SentStep payout={p} consoleHref={consoleHref} />;
    if (p?.status === "held")
      return <BanklessStep amount={amount} name={name} done={{ phone: p.recipient_phone ?? item.draft.recipient_phone ?? "" }} consoleHref={consoleHref} onSend={() => {}} />;
    if (item.state === "failed" || (p && ["failed", "expired", "reversed"].includes(p.status))) {
      return (
        <FailedStep
          title="Didn't send."
          message={item.error ?? p?.failure_reason ?? "The bank refused this transfer."}
          onRetry={() => void send(stripKey(item.draft), item.label)}
          onReEnter={reEnter}
          consoleHref={consoleHref}
        />
      );
    }
    if (offline) return <QueuedScreen episodeId={episodeId} />;
    return <SendingStep amount={amount} name={item.label.name} />;
  }

  if (step === "bankless") {
    return (
      <BanklessStep
        amount={amount}
        name={name}
        consoleHref={consoleHref}
        onBack={() => setStep("qr")}
        onSend={(phone) => send({ ...base, hold: true, recipient_phone: phone }, { name: recipientDisplay(round?.participant_name, null), bank: null })}
      />
    );
  }

  if (step === "qr" && req?.status === "confirmed" && req.account_name && req.bank_code) {
    const n: Named = { source: "qr", accountName: req.account_name, accountNumber: req.account_number ?? "", bankCode: req.bank_code, token: req.token };
    return (
      <NameStep
        named={n}
        banks={banks}
        amount={amount}
        roundLabel={roundLabel}
        caution={caution(n.accountNumber || null)}
        onReEnter={() => setStep("keypad")}
        onSend={() =>
          send({ ...base, account_request_token: n.token }, { name: recipientDisplay(round?.participant_name, n.accountName), bank: shortBank(banks, n.bankCode) })
        }
      />
    );
  }

  if (step === "name" && named) {
    return (
      <NameStep
        named={named}
        banks={banks}
        amount={amount}
        roundLabel={roundLabel}
        caution={caution(named.accountNumber)}
        onReEnter={() => {
          setNamed(null);
          setStep("keypad");
        }}
        onSend={() =>
          send(
            { ...base, account_number: named.accountNumber, bank_code: named.bankCode },
            { name: recipientDisplay(round?.participant_name, named.accountName), bank: shortBank(banks, named.bankCode) },
          )
        }
      />
    );
  }

  if (step === "keypad" || step === "name") {
    return (
      <KeypadStep
        amount={amount}
        roundLabel={roundLabel}
        banks={banks}
        offline={offline}
        caution={caution(null)}
        onShowQr={() => setStep("qr")}
        onNamed={(n) => {
          setNamed(n);
          setStep("name");
        }}
        onQueue={(accountNumber, bankCode) =>
          send({ ...base, account_number: accountNumber, bank_code: bankCode }, { name: recipientDisplay(round?.participant_name, null), bank: shortBank(banks, bankCode) })
        }
      />
    );
  }

  return (
    <QrStep
      amount={amount}
      name={name}
      req={req}
      onType={() => setStep("keypad")}
      onBankless={() => setStep("bankless")}
    />
  );
}

function stripKey(draft: PayoutDraft): Omit<PayoutDraft, "idempotency_key"> {
  const { idempotency_key: _drop, ...rest } = draft; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
}
