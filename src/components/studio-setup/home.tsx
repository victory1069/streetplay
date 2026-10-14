"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar, ButtonLink, Caption, Headline, Logo, PhoneColumn, Row, Spinner, Ticket } from "@/components/ui";
import { StudioNav } from "@/components/ui/studio-nav";
import { useStudio } from "@/components/studio/studio-context";
import { getWalletSummary } from "@/lib/data/studio";
import { listEpisodes } from "@/lib/data/episodes";
import { listPayouts } from "@/lib/data/payouts";
import { formatNaira, formatShort } from "@/lib/money";
import { whenLabel } from "@/lib/format";
import type { Episode, WalletSummary } from "@/types/domain";
import { episodeLabel, nextEpisode, whenUpper } from "./shared";
import { SetupChecklist, type ChecklistItem } from "./onboarding";

interface Past {
  episode: Episode;
  winners: number;
  paid: number;
}

export function Home() {
  const ctx = useStudio();
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [past, setPast] = useState<Past[]>([]);
  const creatorId = ctx?.creator.id;

  useEffect(() => {
    if (!creatorId) return;
    let alive = true;
    getWalletSummary(creatorId)
      .then((s) => alive && setSummary(s))
      .catch(() => {});
    listEpisodes(creatorId)
      .then(async (eps) => {
        if (!alive) return;
        setEpisodes(eps);
        const wrapped = eps.filter((e) => e.status === "wrapped").slice(0, 5);
        const rows = await Promise.all(
          wrapped.map(async (episode) => {
            const sent = (await listPayouts(episode.id).catch(() => [])).filter((p) => p.status === "sent");
            return { episode, winners: sent.length, paid: sent.reduce((s, p) => s + p.amount, 0) };
          }),
        );
        if (alive) setPast(rows);
      })
      .catch(() => alive && setEpisodes([]));
    return () => {
      alive = false;
    };
  }, [creatorId]);

  if (!ctx)
    return (
      <main className="theme-paper flex flex-1 flex-col">
        <Spinner />
      </main>
    );

  const name = ctx.profile?.display_name || ctx.creator.display_name;
  const first = (name.trim().split(/\s+/)[0] || "").toUpperCase();
  const next = episodes ? nextEpisode(episodes) : null;
  const nextWhen = next?.status === "live" ? "LIVE NOW" : next?.starts_at ? whenUpper(next.starts_at, whenLabel(next.starts_at)) : "";

  // You see "Finish setting up" until the wallet is open, funded and the first episode exists.
  const kyc = ctx.creator.kyc_status;
  const walletDone = kyc === "verified" || (kyc === "pending" && Boolean(ctx.creator.kyc_submitted_at));
  const setup: ChecklistItem[] | null =
    summary && episodes
      ? [
          { label: "Set up your show", done: true, href: "/studio/account" },
          {
            label: "Open your wallet",
            done: walletDone,
            href: "/studio/kyc",
            hint: kyc === "rejected" ? "We couldn't verify you. Try again." : "BVN, return account and a selfie. About 2 minutes.",
          },
          { label: "Fund your wallet", done: summary.balance > 0, href: "/studio/wallet/fund?setup=1", hint: "Send any amount to your StreetPlay account." },
          { label: "Plan your first episode", done: episodes.length > 0, href: "/studio/episodes/new", hint: "Pick formats and set a budget." },
        ]
      : null;

  return (
    <main className="theme-paper flex flex-1 flex-col">
      <PhoneColumn>
        <div className="flex flex-1 flex-col px-7 pt-6 pb-6">
          <div className="flex items-center justify-between">
            <Logo />
            <Link href="/studio/account" aria-label="Account">
              <Avatar name={name} size={72} />
            </Link>
          </div>
          <Headline className="mt-5 text-[clamp(52px,16vw,72px)]">How far, {first}.</Headline>

          {setup && setup.some((i) => !i.done) && <SetupChecklist items={setup} />}

          {summary && (
            <section className="mt-5 rounded-[18px] bg-ink p-[18px] text-paper">
              <div className="flex items-baseline justify-between gap-3">
                <Caption className="opacity-80">Wallet</Caption>
                {summary.assigned > 0 && (
                  <span className="truncate font-mono text-[14px] opacity-80">
                    {formatShort(summary.assigned)} assigned{next ? ` to Ep ${next.number}` : ""}
                  </span>
                )}
              </div>
              <p className="font-display tabular mt-2 text-[clamp(56px,18vw,80px)] leading-[0.95] text-yellow">{formatNaira(summary.balance)}</p>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <ButtonLink href="/studio/wallet/fund" variant="yellow" size="md" font="bold">
                  + Fund
                </ButtonLink>
                <ButtonLink href="/studio/wallet?withdraw=1" variant="outline-light" size="md" font="bold" className="border-smoke">
                  Withdraw
                </ButtonLink>
              </div>
            </section>
          )}

          {episodes === null ? (
            <Spinner />
          ) : (
            next && (
              <Ticket
                tone="yellow"
                outline
                className="mt-3"
                bodyClassName="px-6 pt-5 pb-4"
                stubClassName="flex items-center gap-4 px-6 pt-3 pb-4"
                stub={
                  <>
                    <span className="flex-1 font-mono text-[15px] leading-snug">
                      {next.formats.length} formats · {formatNaira(next.budget)}
                    </span>
                    <Link
                      href={`/studio/episodes/${next.id}`}
                      className="font-wide grid min-h-[48px] shrink-0 place-items-center rounded-[10px] bg-ink px-5 text-[17px] text-yellow"
                    >
                      {next.status === "live" ? "Open →" : "Start →"}
                    </Link>
                  </>
                }
              >
                <Caption>
                  Next{nextWhen ? ` · ${nextWhen}` : ""}
                </Caption>
                <p className="font-wide mt-5 text-[clamp(22px,7vw,28px)] leading-tight">{episodeLabel(next)}</p>
              </Ticket>
            )
          )}

          {past.length > 0 && (
            <section className="mt-7">
              <Caption className="mb-3">Past episodes</Caption>
              <div className="border-t-2 border-ink">
                {past.map((p) => (
                  <Row
                    key={p.episode.id}
                    href={`/studio/episodes/${p.episode.id}/log`}
                    title={episodeLabel(p.episode)}
                    sub={`${p.winners} ${p.winners === 1 ? "winner" : "winners"}`}
                    right={formatNaira(p.paid)}
                  />
                ))}
              </div>
            </section>
          )}

          <div className="mt-auto pt-8">
            <ButtonLink href="/studio/episodes/new" variant="outline">
              + New episode
            </ButtonLink>
          </div>
        </div>
        <StudioNav />
      </PhoneColumn>
    </main>
  );
}
