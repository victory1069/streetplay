"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Bar, Button, ButtonLink, Caption, ErrorText, Field, Input, PhoneColumn, Select, Spinner, Arrow } from "@/components/ui";
import { useCountdown } from "@/components/ui/interactive";
import { useStudio } from "@/components/studio/studio-context";
import { addClipMarker, getEpisode, goLive, listRounds, setLiveState, subscribeToEpisode } from "@/lib/data/episodes";
import {
  closePrompt,
  getCurrentPrompt,
  getLeaderboard,
  getLiveSession,
  getPromptStats,
  openPrompt,
  resolvePrompt,
  subscribeToPrompts,
} from "@/lib/data/live";
import { createViewerPrizes } from "@/lib/data/payouts";
import { FORMATS } from "@/lib/games/formats";
import { formatNaira, parseNairaInput } from "@/lib/money";
import { clock, timeWAT } from "@/lib/format";
import type { Episode, LeaderboardRow, LivePrompt, PromptStats, Round } from "@/types/domain";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Try again.");

export function LivePanel({ episodeId }: { episodeId: string }) {
  const studio = useStudio();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [prompt, setPrompt] = useState<LivePrompt | null>(null);
  const [statsFor, setStatsFor] = useState<{ id: string; stats: PromptStats } | null>(null);
  const [players, setPlayers] = useState<number | null>(null);
  const [leaders, setLeaders] = useState<LeaderboardRow[]>([]);
  const [latestRound, setLatestRound] = useState<Round | null>(null);

  const creatorId = studio?.creator.id;
  const handle = studio?.creator.instagram_handle;

  // Episode row (status, live state) + live updates.
  useEffect(() => {
    let alive = true;
    getEpisode(episodeId)
      .then((e) => alive && setEpisode(e))
      .catch(() => {});
    const off = subscribeToEpisode(episodeId, (e) => setEpisode(e));
    return () => {
      alive = false;
      off();
    };
  }, [episodeId]);

  // Current prompt + switch to new ones live.
  useEffect(() => {
    let alive = true;
    getCurrentPrompt(episodeId)
      .then((p) => alive && setPrompt(p))
      .catch(() => {});
    const off = subscribeToPrompts(episodeId, (p) =>
      setPrompt((cur) => (!cur || p.id === cur.id || new Date(p.opened_at) >= new Date(cur.opened_at) ? p : cur)),
    );
    return () => {
      alive = false;
      off();
    };
  }, [episodeId]);

  // Vote split: poll every 1.5s while open, once otherwise.
  const promptId = prompt?.id;
  const promptOpen = prompt?.status === "open";
  useEffect(() => {
    if (!promptId) return;
    let alive = true;
    const tick = () =>
      getPromptStats(promptId)
        .then((stats) => alive && setStatsFor({ id: promptId, stats }))
        .catch(() => {});
    tick();
    const t = promptOpen ? window.setInterval(tick, 1500) : undefined;
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [promptId, promptOpen]);
  const stats = statsFor && statsFor.id === promptId ? statsFor.stats : null;

  // Players on the game page + top predictors, every 5s.
  useEffect(() => {
    if (!creatorId) return;
    let alive = true;
    const tick = () => {
      if (handle)
        getLiveSession(handle)
          .then((s) => alive && setPlayers(s?.players ?? 0))
          .catch(() => {});
      getLeaderboard(creatorId, episodeId, "live", 3)
        .then((rows) => alive && setLeaders(rows))
        .catch(() => {});
      listRounds(episodeId)
        .then((rs) => alive && setLatestRound(rs[rs.length - 1] ?? null))
        .catch(() => {});
    };
    tick();
    const t = window.setInterval(tick, 5000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [creatorId, handle, episodeId]);

  if (!studio || !episode) return <Spinner />;

  return (
    <main className="theme-ink flex flex-1 flex-col">
      <PhoneColumn>
        <header className="flex items-center justify-between gap-3 border-b-2 border-smoke px-5 pt-5 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={`/studio/episodes/${episodeId}`} aria-label="Back to console" className="grid size-11 shrink-0 place-items-center text-[26px] leading-none">
              ←
            </Link>
            <h1 className="font-wide truncate text-[22px] leading-tight">Live control</h1>
          </div>
          <span className="flex shrink-0 items-center gap-2 font-mono text-[14px] font-semibold" aria-live="polite">
            <span className="size-2.5 rounded-full bg-red" aria-hidden />
            {(players ?? 0).toLocaleString("en-NG")} on game page
          </span>
        </header>

        {episode.status !== "live" ? (
          <NotLive episode={episode} onLive={setEpisode} />
        ) : (
          <>
            <div className="flex flex-col px-5 pt-6">
              {prompt ? <PromptCard prompt={prompt} stats={stats} /> : <NoPrompt />}

              <Caption className="mt-9 text-ash">Top predictors</Caption>
              <ol className="mt-3 space-y-2">
                {leaders.length === 0 && <li className="text-[16px] text-ash">No one has scored yet.</li>}
                {leaders.map((r) => (
                  <li key={r.rank} className="flex items-baseline justify-between gap-3">
                    <span className="font-wide truncate text-[19px]">
                      {r.rank} {r.display_name}
                    </span>
                    <span className="font-mono text-[19px] tabular">{r.points}</span>
                  </li>
                ))}
              </ol>

              <ClipMarkers episodeId={episodeId} roundId={prompt?.round_id ?? latestRound?.id ?? null} />
            </div>

            <div className="mt-10 space-y-8 border-t-2 border-smoke px-5 pt-8 pb-12">
              {prompt && (prompt.status !== "resolved" || prompt.kind === "vote") && <PromptControls prompt={prompt} />}
              <AskViewers episodeId={episodeId} round={latestRound} />
              <ViewerPrizes episodeId={episodeId} />
              <WaitingNote key={episode.live_state.note ?? ""} episode={episode} />
            </div>
          </>
        )}
      </PhoneColumn>
    </main>
  );
}

function NotLive({ episode, onLive }: { episode: Episode; onLive: (e: Episode) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (episode.status === "wrapped")
    return (
      <div className="space-y-5 px-5 pt-8">
        <p className="font-display text-[48px]">This episode has wrapped.</p>
        <p className="text-[17px] text-ash">The live panel only works while an episode is live.</p>
        <ButtonLink href={`/studio/episodes/${episode.id}/log`} variant="yellow">
          See the log <Arrow />
        </ButtonLink>
      </div>
    );
  return (
    <div className="space-y-5 px-5 pt-8">
      <p className="font-display text-[56px]">Not live yet.</p>
      <p className="text-[17px] leading-snug text-ash">
        Going live opens the game page for viewers, starts the vote split and the board, and pings everyone who asked to be told when Ep {episode.number} starts.
      </p>
      <ErrorText>{error}</ErrorText>
      <Button
        variant="yellow"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            onLive(await goLive(episode.id));
          } catch (e) {
            setError(errMsg(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Go live <Arrow />
      </Button>
    </div>
  );
}

function NoPrompt() {
  return (
    <div>
      <Caption className="text-ash">No vote open</Caption>
      <p className="font-wide mt-3 text-[26px] leading-tight">Viewers are waiting for the next round.</p>
      <p className="mt-2 text-[16px] text-ash">Rounds open their own votes. You can ask viewers something below.</p>
    </div>
  );
}

function PromptCard({ prompt, stats }: { prompt: LivePrompt; stats: PromptStats | null }) {
  const left = useCountdown(prompt.status === "open" ? prompt.closes_at : null);
  const label = prompt.label ?? `${prompt.round_number ? `R${prompt.round_number} ` : ""}${prompt.kind}`;
  const state =
    prompt.status === "resolved" ? "REVEALED" : prompt.status === "closed" || left === 0 ? "CLOSED" : left != null ? `CLOSES ${clock(left)}` : "OPEN";
  const total = stats?.answered ?? 0;
  return (
    <section>
      <Caption className="text-ash">
        <span aria-live="polite">
          {label} · {state}
        </span>
      </Caption>
      <h2 className="font-wide mt-3 text-[30px] leading-[1.1]">{prompt.question}</h2>
      {prompt.options.length > 0 ? (
        <div className="mt-4 space-y-3">
          {prompt.options.map((opt, i) => {
            const n = stats?.options[i] ?? 0;
            const pct = total ? Math.round((n / total) * 100) : 0;
            const correct = prompt.status === "resolved" && prompt.correct_option === i;
            return (
              <div key={i}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-wide text-[19px]">
                    {opt}
                    {correct && <span className="ml-2 text-green">✓</span>}
                  </span>
                  <span className="font-mono text-[18px] font-semibold tabular">
                    {pct}% · {n.toLocaleString("en-NG")}
                  </span>
                </div>
                <Bar value={total ? n / total : 0} tone="dark" fill={i === 0 ? "yellow" : "paper"} className="mt-2 h-[14px]" />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 font-mono text-[16px] text-ash">{total.toLocaleString("en-NG")} answers</p>
      )}
    </section>
  );
}

const MARKERS = [
  { label: "funny", text: "Funny" },
  { label: "big-win", text: "Big win" },
  { label: "reaction", text: "Reaction" },
] as const;

function ClipMarkers({ episodeId, roundId }: { episodeId: string; roundId: string | null }) {
  const [last, setLast] = useState<string | null>(null);
  return (
    <div className="mt-4">
      <div className="grid grid-cols-3 gap-2">
        {MARKERS.map((m) => (
          <button
            key={m.label}
            type="button"
            onClick={async () => {
              await addClipMarker(episodeId, m.label, roundId);
              navigator.vibrate?.(20);
              setLast(m.text);
              window.setTimeout(() => setLast(null), 1500);
            }}
            className={`font-wide flex min-h-[52px] items-center justify-center gap-1.5 rounded-[12px] border-2 text-[15px] active:scale-[0.98] ${last === m.text ? "border-yellow text-yellow" : "border-smoke"}`}
          >
            <span aria-hidden>◆</span> {m.text}
          </button>
        ))}
      </div>
      <p className="mt-2 h-5 font-mono text-[13px] text-ash" aria-live="polite">
        {last ? `◆ ${last} marked` : ""}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <Caption className="mb-3 text-ash">{title}</Caption>
      {children}
    </section>
  );
}

function PromptControls({ prompt }: { prompt: LivePrompt }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Section title="This prompt">
      <div className="space-y-3">
        {prompt.status === "open" && (
          <Button variant="outline-light" size="md" font="bold" loading={busy === "close"} onClick={() => run("close", () => closePrompt(prompt.id))}>
            Close voting
          </Button>
        )}
        {prompt.kind === "predict" && prompt.status !== "resolved" && (
          <>
            <p className="text-[16px] text-ash">Reveal: which one happened? Right predictions score +100.</p>
            <div className="grid grid-cols-2 gap-2">
              {prompt.options.map((o, i) => (
                <Button key={i} variant="yellow" size="sm" font="bold" loading={busy === `r${i}`} onClick={() => run(`r${i}`, () => resolvePrompt(prompt.id, i))}>
                  {o}
                </Button>
              ))}
            </div>
          </>
        )}
        {prompt.kind === "vote" && prompt.status !== "resolved" && (
          <Button variant="outline-light" size="md" font="bold" loading={busy === "reveal"} onClick={() => run("reveal", () => resolvePrompt(prompt.id, null))}>
            Show result to viewers
          </Button>
        )}
        {prompt.status === "resolved" && <p className="font-mono text-[14px] text-ash">Revealed {timeWAT(prompt.resolved_at)}.</p>}
        <ErrorText>{error}</ErrorText>
      </div>
    </Section>
  );
}

function AskViewers({ episodeId, round }: { episodeId: string; round: Round | null }) {
  const [kind, setKind] = useState<"vote" | "predict">("vote");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [duration, setDuration] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = options.map((o) => o.trim()).filter(Boolean);
  const ok = question.trim().length >= 3 && clean.length >= 2;

  return (
    <Section title="Ask viewers">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ok) return;
          setBusy(true);
          setError(null);
          try {
            await openPrompt({
              episodeId,
              roundId: round?.id ?? null,
              roundNumber: round?.number ?? null,
              kind,
              question: question.trim(),
              options: clean,
              label: `${round?.number ? `R${round.number} ` : ""}${kind.toUpperCase()}`,
              durationSeconds: Number(duration) || undefined,
            });
            setQuestion("");
            setOptions(["", ""]);
          } catch (err) {
            setError(errMsg(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="flex gap-2" role="radiogroup" aria-label="Kind">
          {(["vote", "predict"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`min-h-[44px] flex-1 rounded-full text-[16px] font-bold ${kind === k ? "bg-yellow text-ink" : "border-2 border-smoke"}`}
            >
              {k === "vote" ? "Vote" : "Predict"}
            </button>
          ))}
        </div>
        <Field label={<span className="text-ash">Question</span>}>
          <Input tone="dark" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={kind === "vote" ? "Walk away or go again?" : "Will she reach ₦50k?"} maxLength={120} />
        </Field>
        {options.map((o, i) => (
          <Input
            key={i}
            tone="dark"
            aria-label={`Option ${i + 1}`}
            value={o}
            placeholder={`Option ${i + 1}`}
            maxLength={40}
            onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
          />
        ))}
        {options.length < 4 && (
          <button type="button" className="min-h-[44px] font-mono text-[15px] underline underline-offset-4" onClick={() => setOptions([...options, ""])}>
            + Add option
          </button>
        )}
        <Field label={<span className="text-ash">Open for</span>}>
          <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
            <option value="15">15 seconds</option>
            <option value="30">30 seconds</option>
            <option value="60">1 minute</option>
            <option value="0">Until I close it</option>
          </Select>
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" variant="yellow" size="md" loading={busy} disabled={!ok}>
          Open {kind} <Arrow />
        </Button>
      </form>
    </Section>
  );
}

function ViewerPrizes({ episodeId }: { episodeId: string }) {
  const [amount, setAmount] = useState("");
  const [top, setTop] = useState("3");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const kobo = parseNairaInput(amount);
  const n = Number(top);

  return (
    <Section title="Viewer prizes">
      <div className="space-y-3">
        <p className="text-[16px] leading-snug text-ash">Top players on this Live&apos;s board each win the amount. They claim it within 24 hours.</p>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input
            tone="dark"
            mono
            inputMode="numeric"
            aria-label="Amount each"
            placeholder="₦5,000 each"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setConfirming(false);
            }}
          />
          <Select
            aria-label="How many winners"
            value={top}
            onChange={(e) => {
              setTop(e.target.value);
              setConfirming(false);
            }}
          >
            {[1, 3, 5, 10].map((x) => (
              <option key={x} value={x}>
                Top {x}
              </option>
            ))}
          </Select>
        </div>
        <ErrorText>{error}</ErrorText>
        {done && <p className="font-mono text-[15px] text-green" aria-live="polite">{done}</p>}
        {!confirming ? (
          <Button variant="outline-light" size="md" font="bold" disabled={!kobo} onClick={() => setConfirming(true)}>
            Give prizes
          </Button>
        ) : (
          <div className="space-y-2 rounded-[14px] border-2 border-yellow p-4">
            <p className="text-[17px]">
              {formatNaira(kobo ?? 0)} each to the top {n}: up to <b>{formatNaira((kobo ?? 0) * n)}</b> from the wallet.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline-light" size="sm" font="bold" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button
                variant="yellow"
                size="sm"
                font="bold"
                loading={busy}
                onClick={async () => {
                  if (!kobo) return;
                  setBusy(true);
                  setError(null);
                  try {
                    const { created } = await createViewerPrizes(episodeId, kobo, n);
                    setDone(`${created.length} prize${created.length === 1 ? "" : "s"} created. Winners see a claim button.`);
                    setConfirming(false);
                    setAmount("");
                  } catch (e) {
                    setError(errMsg(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Confirm
              </Button>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

function WaitingNote({ episode }: { episode: Episode }) {
  const [note, setNote] = useState(episode.live_state.note ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = episode.live_state.format ? FORMATS[episode.live_state.format]?.name : null;
  return (
    <Section title="Waiting screen">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await setLiveState(episode.id, { ...episode.live_state, note: note.trim() || undefined });
            setSaved(true);
            window.setTimeout(() => setSaved(false), 1500);
          } catch (err) {
            setError(errMsg(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="text-[16px] text-ash">
          A line viewers see between rounds{next ? ` (next up: ${next})` : ""}.
        </p>
        <Input tone="dark" aria-label="Waiting screen note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Next round in 2 mins. Stay close!" maxLength={100} />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" variant="outline-light" size="md" font="bold" loading={busy}>
          {saved ? "Saved ✓" : "Update note"}
        </Button>
      </form>
    </Section>
  );
}
