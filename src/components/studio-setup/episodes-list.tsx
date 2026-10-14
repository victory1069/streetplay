"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonLink, Caption, Headline, LiveBadge, PhoneColumn, Row, Spinner, Ticket } from "@/components/ui";
import { StudioNav } from "@/components/ui/studio-nav";
import { useStudio } from "@/components/studio/studio-context";
import { listEpisodes } from "@/lib/data/episodes";
import { listPayouts } from "@/lib/data/payouts";
import { dateWAT, whenLabel } from "@/lib/format";
import { formatNaira } from "@/lib/money";
import type { Episode } from "@/types/domain";
import { episodeLabel } from "./shared";

export function EpisodesList() {
  const ctx = useStudio();
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [paid, setPaid] = useState<Record<string, number>>({});
  const creatorId = ctx?.creator.id;

  useEffect(() => {
    if (!creatorId) return;
    let alive = true;
    listEpisodes(creatorId)
      .then(async (eps) => {
        if (!alive) return;
        setEpisodes(eps);
        const wrapped = eps.filter((e) => e.status === "wrapped").slice(0, 20);
        const totals = await Promise.all(
          wrapped.map(async (e) => {
            const ps = await listPayouts(e.id).catch(() => []);
            return [e.id, ps.filter((p) => p.status === "sent").reduce((s, p) => s + p.amount, 0)] as const;
          }),
        );
        if (alive) setPaid(Object.fromEntries(totals));
      })
      .catch(() => alive && setEpisodes([]));
    return () => {
      alive = false;
    };
  }, [creatorId]);

  const live = episodes?.filter((e) => e.status === "live") ?? [];
  const rest = episodes?.filter((e) => e.status !== "live") ?? [];

  return (
    <main className="theme-paper flex flex-1 flex-col">
      <PhoneColumn>
        <div className="flex flex-1 flex-col px-7 pt-8 pb-6">
          <Headline className="text-[clamp(52px,16vw,72px)]">Episodes</Headline>

          {!ctx || episodes === null ? (
            <Spinner />
          ) : (
            <>
              {live.map((e) => (
                <Link key={e.id} href={`/studio/episodes/${e.id}`} className="mt-5 block">
                  <Ticket tone="yellow" outline bodyClassName="px-6 py-5">
                    <div className="flex items-center justify-between gap-3">
                      <LiveBadge />
                      <span className="font-mono text-[15px]">{formatNaira(e.budget)}</span>
                    </div>
                    <p className="font-wide mt-4 text-[clamp(22px,7vw,28px)] leading-tight">{episodeLabel(e)}</p>
                    <p className="font-wide mt-2 text-[17px]">Open console →</p>
                  </Ticket>
                </Link>
              ))}

              {rest.length > 0 && (
                <section className="mt-7">
                  <Caption className="mb-3">All episodes</Caption>
                  <div className="border-t-2 border-ink">
                    {rest.map((e) => (
                      <Row
                        key={e.id}
                        href={e.status === "wrapped" ? `/studio/episodes/${e.id}/log` : `/studio/episodes/${e.id}`}
                        title={episodeLabel(e)}
                        sub={
                          e.status === "wrapped"
                            ? `Wrapped · ${dateWAT(e.wrapped_at ?? e.created_at)}`
                            : e.starts_at
                              ? `Draft · ${whenLabel(e.starts_at)}`
                              : `Draft · ${e.formats.length} formats`
                        }
                        right={e.status === "wrapped" ? (paid[e.id] !== undefined ? formatNaira(paid[e.id]) : "") : formatNaira(e.budget)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {episodes.length === 0 && (
                <p className="mt-6 text-[18px] leading-snug opacity-80">No episodes yet. Plan your first one: pick the games, set the budget.</p>
              )}
            </>
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
