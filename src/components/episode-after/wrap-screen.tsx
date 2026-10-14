"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button, ButtonLink, ErrorText, PhoneColumn, SideNotches, Spinner } from "@/components/ui";
import { share } from "@/components/ui/interactive";
import { useStudio } from "@/components/studio/studio-context";
import { episodeTotals, wrapEpisode } from "@/lib/data/episodes";
import { withdrawMax } from "@/lib/data/studio";
import { queuedCount } from "@/lib/offline/outbox";
import { bankName, listBanks } from "@/lib/data/payouts";
import { formatNaira } from "@/lib/money";
import { appUrl, titleCase } from "@/lib/format";
import type { Bank } from "@/lib/payments/types";
import { useEpisodeLog } from "./use-episode-log";

export function WrapScreen({ episodeId }: { episodeId: string }) {
  const studio = useStudio();
  const router = useRouter();
  const { log, error: loadError } = useEpisodeLog(episodeId);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [choice, setChoice] = useState<"rollover" | "withdraw">("rollover");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wrappedButFailed, setWrappedButFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    listBanks()
      .then((b) => alive && setBanks(b))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (loadError)
    return (
      <main className="theme-paper flex flex-1 flex-col">
        <PhoneColumn className="p-6">
          <ErrorText>{loadError}</ErrorText>
        </PhoneColumn>
      </main>
    );
  if (!log || !studio) return <Spinner />;

  const { episode } = log;
  const totals = episodeTotals(log);
  const left = totals.budgetLeft;
  const creator = studio.creator;
  const canWithdraw = Boolean(creator.return_account_number) && left > 0;
  const already = episode.status === "wrapped";
  const recap = `${formatNaira(totals.paidTotal)} paid · ${totals.paidCount} ${totals.paidCount === 1 ? "stranger" : "strangers"}`;

  const close = async () => {
    setBusy(true);
    setError(null);
    // Don't close while a promised payout is still on its way: a queued
    // payout would be refused once the episode is wrapped.
    if (!already) {
      const queued = await queuedCount(episodeId).catch(() => 0);
      const pending = log.payouts.filter((p) => p.status === "sending").length;
      if (queued + pending > 0) {
        setError(`${queued + pending} payout${queued + pending === 1 ? " is" : "s are"} still on the way. Close the episode once ${queued + pending === 1 ? "it's" : "they're"} sent.`);
        setBusy(false);
        return;
      }
    }
    try {
      if (!already && !wrappedButFailed) await wrapEpisode(episodeId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't close the episode. Try again.");
      setBusy(false);
      return;
    }
    if (already && !wrappedButFailed) {
      router.push("/studio");
      return;
    }
    if (choice === "withdraw" && canWithdraw) {
      try {
        await withdrawMax(left, episodeId);
      } catch (e) {
        setWrappedButFailed(true);
        setError(`Episode closed, but the withdrawal didn't go: ${e instanceof Error ? e.message : "try again from the wallet."}`);
        setBusy(false);
        return;
      }
    }
    router.push("/studio");
  };

  return (
    <main className="theme-paper flex flex-1 flex-col">
      <PhoneColumn className="px-5 pt-10 pb-6">
        <p className="font-shout text-[clamp(44px,13vw,60px)]" style={{ textShadow: "0.06em 0.06em 0 var(--yellow)" }}>
          Na wrap!
        </p>
        <h1 className="font-display mt-3 text-[clamp(52px,16vw,80px)]">
          Ep {episode.number} paid {totals.paidCount} {totals.paidCount === 1 ? "person" : "people"} {formatNaira(totals.paidTotal)}.
        </h1>

        {already && !wrappedButFailed ? (
          <p className="mt-4 text-[19px] leading-snug">This episode is closed. Anything left from the budget is in your wallet.</p>
        ) : left > 0 ? (
          <>
            <p className="mt-4 text-[19px] leading-snug">{formatNaira(left)} of the budget is left. What should happen to it?</p>
            <div className="mt-4 space-y-4" role="radiogroup" aria-label="Leftover budget">
              <Choice selected={choice === "rollover"} onSelect={() => setChoice("rollover")} title={`Roll over to Ep ${episode.number + 1}`} sub="Stays in your wallet, assigned" />
              {canWithdraw ? (
                <Choice
                  selected={choice === "withdraw"}
                  onSelect={() => setChoice("withdraw")}
                  title={
                    <>
                      Withdraw to {bankName(banks, creator.return_bank_code)} ••{creator.return_account_number?.slice(-2)}
                    </>
                  }
                  sub={`${titleCase(creator.return_account_name ?? creator.display_name)} · arrives in minutes`}
                />
              ) : null}
            </div>
          </>
        ) : (
          <p className="mt-4 text-[19px] leading-snug">The whole budget went to winners.</p>
        )}

        <div className="mt-auto space-y-4 pt-10">
          <button
            type="button"
            onClick={() => void share({ title: `Ep ${episode.number} · ${episode.title}`, text: recap, url: appUrl(`/e/${episode.public_code}`) })}
            className="flex w-full items-center justify-between gap-3 rounded-[14px] border-[3px] border-ink bg-yellow px-6 py-3 text-left"
          >
            <span className="min-w-0">
              <span className="font-wide block text-[20px]">Recap post ready</span>
              <span className="block truncate font-mono text-[14px]">&quot;{recap}&quot;</span>
            </span>
            <span className="font-wide shrink-0 text-[20px]">Share ↗</span>
          </button>
          <ErrorText>{error}</ErrorText>
          {wrappedButFailed ? (
            <div className="grid grid-cols-2 gap-3">
              <ButtonLink href="/studio/wallet" variant="outline" size="md" font="bold">
                Wallet
              </ButtonLink>
              <Button variant="ink" size="md" loading={busy} onClick={close}>
                Try again
              </Button>
            </div>
          ) : (
            <Button variant="ink" loading={busy} onClick={close}>
              {already ? "Back to studio" : "Close episode"}
            </Button>
          )}
        </div>
      </PhoneColumn>
    </main>
  );
}

function Choice({ selected, onSelect, title, sub }: { selected: boolean; onSelect: () => void; title: ReactNode; sub: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`relative flex w-full items-center gap-4 rounded-[18px] px-8 py-4 text-left ${selected ? "bg-ink text-paper" : "border-[3px] border-ink bg-card text-ink"}`}
    >
      {selected && <SideNotches />}
      <span className="min-w-0 flex-1">
        <span className="font-wide block text-[22px] leading-tight">{title}</span>
        <span className={`mt-1 block font-mono text-[14px] ${selected ? "text-ash" : "text-muted"}`}>{sub}</span>
      </span>
      {selected ? (
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-yellow text-[24px] text-ink">✓</span>
      ) : (
        <span className="block size-12 shrink-0 rounded-full border-2 border-ink" />
      )}
    </button>
  );
}
