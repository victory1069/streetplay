"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Amount, Bar, Button, ButtonLink, Caption, ErrorText, Input, Label, PhoneColumn, Row, Spinner } from "@/components/ui";
import { Sheet } from "@/components/ui/interactive";
import { StudioNav } from "@/components/ui/studio-nav";
import { useStudio } from "@/components/studio/studio-context";
import { getWalletSummary, groupActivity, listWalletActivity, subscribeToWallet, withdraw, withdrawMax, type ActivityEntry } from "@/lib/data/studio";
import { listEpisodes } from "@/lib/data/episodes";
import { bankName, listBanks } from "@/lib/data/payouts";
import { FORMATS } from "@/lib/games/formats";
import { dateWAT } from "@/lib/format";
import { formatNaira, formatSigned, parseNairaInput, toNaira } from "@/lib/money";
import type { Bank } from "@/lib/payments/types";
import type { Episode, WalletSummary } from "@/types/domain";
import { errorMessage } from "./shared";

type Item = ReturnType<typeof groupActivity>[number];

const ep = (e: { number: number } | null | undefined) => (e ? `Ep ${e.number}` : "");
const join = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");

export function Wallet() {
  const ctx = useStudio();
  const router = useRouter();
  const params = useSearchParams();
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loadedAt, setLoadedAt] = useState(0);
  const [sheet, setSheet] = useState(params.get("withdraw") === "1");
  const reloadRef = useRef<() => Promise<void>>(async () => {});
  const creatorId = ctx?.creator.id;

  const load = useCallback(async () => {
    if (!creatorId) return;
    const [s, a, eps] = await Promise.all([
      getWalletSummary(creatorId).catch(() => null),
      listWalletActivity(creatorId).catch(() => [] as ActivityEntry[]),
      listEpisodes(creatorId).catch(() => [] as Episode[]),
    ]);
    return { s, items: groupActivity(a), eps, at: Date.now() };
  }, [creatorId]);

  useEffect(() => {
    if (!creatorId) return;
    let alive = true;
    const reload = () =>
      load().then((r) => {
        if (!alive || !r) return;
        setSummary(r.s);
        setItems(r.items);
        setEpisodes(r.eps);
        setLoadedAt(r.at);
      });
    reloadRef.current = reload;
    void reload();
    listBanks()
      .then((b) => alive && setBanks(b))
      .catch(() => {});
    const unsubscribe = subscribeToWallet(creatorId, () => void reload());
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [creatorId, load]);

  if (!ctx || !summary || !items)
    return (
      <main className="theme-paper flex flex-1 flex-col">
        <Spinner />
        <StudioNav />
      </main>
    );

  const c = ctx.creator;
  const returnBank = c.return_bank_code ? bankName(banks, c.return_bank_code) : null;
  const returnLabel = c.return_account_number ? `${returnBank ?? "Bank"} ••${c.return_account_number.slice(-2)}` : null;
  const funded = episodes.filter((e) => e.status !== "wrapped" && e.budget > 0);
  const assignedLabel = funded.length === 1 ? `Ep ${funded[0].number}` : "Assigned";
  const share = summary.balance > 0 ? Math.min(1, summary.assigned / summary.balance) : 0;

  const when = (iso: string) => (loadedAt && loadedAt - new Date(iso).getTime() < 120_000 ? "just now" : dateWAT(iso));

  const describe = (it: Item): { title: string; sub: string } => {
    if (it.kind === "fee-group") return { title: join("Payout fees", ep(it.episode)), sub: `${it.count} ${it.count === 1 ? "transfer" : "transfers"}` };
    const e = it as ActivityEntry;
    switch (e.kind) {
      case "topup": {
        const [who, bank] = (e.counterparty ?? "").split(" · ");
        return { title: join("Transfer in", who || null), sub: join(bank, when(e.created_at), e.episode && `→ Ep ${e.episode.number}`) };
      }
      case "sponsor":
        return { title: join("Sponsor funding", ep(e.episode)), sub: join(e.counterparty || "Funding link", when(e.created_at)) };
      case "payout": {
        const fmt = e.payout?.round?.format;
        return {
          title: join(e.payout?.recipient_display ?? "Winner", ep(e.episode)),
          sub: join(fmt ? FORMATS[fmt as keyof typeof FORMATS]?.name : null, when(e.created_at)),
        };
      }
      case "withdrawal":
        return {
          title: join("Withdrawal", e.counterparty || returnLabel),
          sub: join(e.note || (e.episode ? `Ep ${e.episode.number} leftover` : null), when(e.created_at)),
        };
      case "refund":
        return { title: join("Refund", ep(e.episode)), sub: join(e.note || "Transfer returned", when(e.created_at)) };
      default:
        return { title: "Adjustment", sub: join(e.note, when(e.created_at)) };
    }
  };

  const closeSheet = () => {
    setSheet(false);
    if (params.get("withdraw")) router.replace("/studio/wallet");
  };

  return (
    <main className="theme-paper flex flex-1 flex-col">
      <PhoneColumn>
        <div className="flex flex-1 flex-col px-7 pt-10 pb-6">
          <Caption>Wallet balance</Caption>
          <Amount className="mt-3 text-[clamp(72px,24vw,112px)]">{formatNaira(summary.balance)}</Amount>
          <Bar value={share} tone="outlined" className="mt-5" />
          <div className="mt-4 flex justify-between gap-3 font-mono text-[15px]">
            <span>
              <span aria-hidden>■</span> {assignedLabel} · {formatNaira(summary.assigned)}
            </span>
            <span>
              <span aria-hidden>□</span> Free · {formatNaira(summary.free)}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2.5">
            <ButtonLink href="/studio/wallet/fund" size="lg" className="min-h-[52px]">
              + Fund
            </ButtonLink>
            <Button variant="outline" className="min-h-[52px]" onClick={() => setSheet(true)}>
              Withdraw
            </Button>
          </div>

          <Caption className="mt-8 mb-3">Activity</Caption>
          <div className="border-t-2 border-ink">
            {items.length === 0 && <p className="py-5 text-[17px] opacity-70">Nothing yet. Fund your wallet to get started.</p>}
            {items.map((it, i) => {
              const d = describe(it);
              return <Row key={"id" in it ? it.id : `fees-${i}`} title={d.title} sub={d.sub} right={formatSigned(it.amount)} />;
            })}
          </div>
        </div>
        <StudioNav />
      </PhoneColumn>

      <WithdrawSheet
        open={sheet}
        onClose={closeSheet}
        free={summary.free}
        destination={returnLabel}
        onDone={() => {
          closeSheet();
          void reloadRef.current();
        }}
      />
    </main>
  );
}

function WithdrawSheet({
  open,
  onClose,
  free,
  destination,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  free: number;
  destination: string | null;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(() => (free > 0 ? String(toNaira(free)) : ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet open={open} onClose={onClose}>
      <h2 className="font-wide text-[26px]">Withdraw</h2>
      {!destination ? (
        <div className="mt-4 space-y-5">
          <p className="text-[18px] leading-snug">Add a return account first. Withdrawals only go to your own verified account.</p>
          <ButtonLink href="/studio/kyc">
            Open your wallet <span aria-hidden>→</span>
          </ButtonLink>
        </div>
      ) : (
        <form
          className="mt-5 space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const kobo = parseNairaInput(amount);
            if (!kobo || kobo <= 0) return setError("Enter an amount.");
            if (kobo > free) return setError(`You have ${formatNaira(free)} free. The rest is assigned to episodes.`);
            setBusy(true);
            setError(null);
            try {
              // Asking for everything free: the server deducts the transfer fee.
              await (kobo >= free ? withdrawMax() : withdraw(kobo));
              onDone();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block">
            <Label className="mb-2.5">Amount · {formatNaira(free)} free</Label>
            <Input big mono inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" aria-label="Amount in naira" />
          </label>
          <div className="flex items-baseline justify-between gap-3 border-y-2 border-ink py-4 font-mono text-[16px]">
            <span className="opacity-70">To</span>
            <span className="font-semibold">{destination}</span>
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" loading={busy}>
            Withdraw {parseNairaInput(amount) ? formatNaira(parseNairaInput(amount)!) : ""}
          </Button>
        </form>
      )}
    </Sheet>
  );
}
