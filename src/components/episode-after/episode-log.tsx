"use client";

import Link from "next/link";
import { useState } from "react";
import { Chip, ErrorText, PhoneColumn, Row, Spinner, TopBar } from "@/components/ui";
import { episodeTotals } from "@/lib/data/episodes";
import { formatNaira, formatShort } from "@/lib/money";
import { timeWAT } from "@/lib/format";
import { LIVE_PAYOUT, MARKER_NAMES, roundLine, useEpisodeLog } from "./use-episode-log";

type Filter = "all" | "payouts" | "clips" | "consent";

const STATUS: Record<string, string> = {
  held: "held for claim",
  sending: "sending",
  sent: "sent",
  failed: "failed",
  reversed: "reversed",
  expired: "expired",
};

export function EpisodeLogScreen({ episodeId }: { episodeId: string }) {
  const { log, error } = useEpisodeLog(episodeId);
  const [filter, setFilter] = useState<Filter>("all");

  if (error)
    return (
      <main className="theme-paper flex flex-1 flex-col">
        <PhoneColumn className="p-6">
          <ErrorText>{error}</ErrorText>
        </PhoneColumn>
      </main>
    );
  if (!log) return <Spinner />;

  const { episode, rounds, payouts, consents, markers } = log;
  const totals = episodeTotals(log);
  const roundById = new Map(rounds.map((r) => [r.id, r]));
  const consentCount = new Set(consents.map((c) => c.round_id)).size;
  const clipsFor = (roundId: string) => markers.filter((m) => m.round_id === roundId).length;

  type Item = { key: string; at: string; title: string; sub: string; right?: string };
  let items: Item[] = [];

  if (filter === "all") {
    for (const r of rounds) {
      const ps = payouts.filter((p) => p.round_id === r.id && LIVE_PAYOUT.includes(p.status));
      const amount = ps.reduce((s, p) => s + p.amount, 0);
      const consent = consents.some((c) => c.round_id === r.id);
      const clips = clipsFor(r.id);
      items.push({
        key: r.id,
        at: ps[0]?.created_at ?? r.started_at ?? r.created_at,
        title: ps[0]?.recipient_display ?? r.participant_name ?? "No name",
        sub: [roundLine(r), consent ? "✓ consent" : null, clips ? `◆${clips}` : null].filter(Boolean).join(" · "),
        right: formatNaira(amount),
      });
    }
    for (const p of payouts.filter((x) => !x.round_id && LIVE_PAYOUT.includes(x.status))) {
      items.push({ key: p.id, at: p.created_at, title: p.recipient_display ?? "Viewer", sub: `Viewer prize · ${STATUS[p.status]}`, right: formatNaira(p.amount) });
    }
  } else if (filter === "payouts") {
    items = payouts.map((p) => ({
      key: p.id,
      at: p.sent_at ?? p.created_at,
      title: p.recipient_display ?? "Winner",
      sub: `${p.round_id ? roundLine(roundById.get(p.round_id), false) : "Viewer prize"} · ${STATUS[p.status] ?? p.status}`,
      right: formatNaira(p.amount),
    }));
  } else if (filter === "clips") {
    items = markers.map((m) => {
      const r = m.round_id ? roundById.get(m.round_id) : undefined;
      return {
        key: m.id,
        at: m.at,
        title: `◆ ${MARKER_NAMES[m.label] ?? m.label}`,
        sub: r ? `${roundLine(r, false)}${r.participant_name ? ` · ${r.participant_name}` : ""}` : "Between rounds",
      };
    });
  } else {
    items = consents.map((c) => ({
      key: c.id,
      at: c.agreed_at,
      title: c.name_given,
      sub: `${roundLine(roundById.get(c.round_id), false)} · release ${c.release_version}`,
    }));
  }
  items.sort((a, b) => b.at.localeCompare(a.at));

  const empty: Record<Filter, string> = {
    all: "No rounds yet.",
    payouts: "No payouts yet.",
    clips: "No clip marks yet. Tap ◆ on the live panel while filming.",
    consent: "No consents recorded yet.",
  };

  return (
    <main className="theme-paper flex flex-1 flex-col">
      <PhoneColumn>
        <TopBar
          title={`Ep ${episode.number} · log`}
          back={`/studio/episodes/${episodeId}`}
          right={
            <Link href={`/studio/episodes/${episodeId}/log/export`} className="inline-flex min-h-[44px] items-center px-1">
              Export
            </Link>
          }
        />
        <div className="px-5 pt-5 pb-10">
          <div className="grid grid-cols-3 overflow-hidden rounded-[14px] border-[3px] border-ink">
            <Stat value={formatShort(totals.paidTotal)} label="Paid" className="bg-yellow" />
            <Stat
              value={consentCount === rounds.length ? String(rounds.length) : `${consentCount}/${rounds.length}`}
              label="Rounds · consents"
              className="border-l-[3px] border-ink bg-card"
            />
            <Stat value={String(markers.length)} label="Clip marks" className="border-l-[3px] border-ink bg-card" />
          </div>

          <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
            {(
              [
                ["all", "All"],
                ["payouts", "Payouts"],
                ["clips", "Clips"],
                ["consent", "Consent"],
              ] as const
            ).map(([k, label]) => (
              <Chip key={k} selected={filter === k} onClick={() => setFilter(k)} className={filter === k ? "[&>span]:hidden" : ""}>
                {label}
              </Chip>
            ))}
          </div>

          <div className="mt-3 border-t-2 border-ink">
            {items.length === 0 && <p className="py-6 text-[17px] text-muted">{empty[filter]}</p>}
            {items.map((it) => (
              <Row key={it.key} lead={timeWAT(it.at)} title={it.title} sub={it.sub} right={it.right} />
            ))}
          </div>
        </div>
      </PhoneColumn>
    </main>
  );
}

function Stat({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  return (
    <div className={`px-3 py-3 ${className}`}>
      <p className="font-display tabular text-[clamp(32px,10vw,44px)]">{value}</p>
      <p className="mt-1 font-mono text-[12px] leading-tight uppercase">{label}</p>
    </div>
  );
}
