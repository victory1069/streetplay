"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Arrow, Bar, Button, Caption, Chip, ErrorText, Headline, Input, Label, PhoneColumn, Spinner, Ticket, TopBar } from "@/components/ui";
import { useStudioState } from "@/components/studio/studio-context";
import { getWalletSummary, listCustomQuestions, setDefaultEpisode } from "@/lib/data/studio";
import { createEpisode, listEpisodes } from "@/lib/data/episodes";
import { MVP_FORMATS, FORMATS } from "@/lib/games/formats";
import { defaultConfirmAbove, maxPrize, planDetail, splitBudget } from "@/lib/games/plan";
import { QUESTION_PACKS, SONG_PACKS } from "@/content";
import { whenLabel } from "@/lib/format";
import { formatNaira, naira, parseNairaInput, toNaira } from "@/lib/money";
import type { Episode, FormatId, Kobo } from "@/types/domain";
import { errorMessage, FORMAT_CATEGORY } from "./shared";

// New episode wizard: Name/formats → Budget → Content, one page, local state.
// The draft is kept in sessionStorage so "Write your own" and back doesn't lose it.

const DRAFT_KEY = "sp:new-episode";
const PLAN_ORDER: FormatId[] = ["money-ladder", "spin-the-wheel", "pick-a-box", "finish-the-lyric", "name-the-song", "quickfire-trivia"];
const QUIZ: FormatId[] = ["money-ladder", "quickfire-trivia"];
const MUSIC: FormatId[] = ["finish-the-lyric", "name-the-song"];
const REPEAT: Episode["repeat_policy"][] = ["flag", "allow", "block"];
const REPEAT_LABEL: Record<Episode["repeat_policy"], string> = { flag: "Flag me", allow: "Allow", block: "Block" };
const STEP_TITLE = ["New episode", "Budget", "Content"];

interface Draft {
  step: number;
  title: string;
  location: string;
  when: string;
  formats: FormatId[];
  budget: Kobo;
  maxOverride: Kobo | null;
  confirmOverride: Kobo | null;
  repeat: Episode["repeat_policy"];
  packIds: string[];
}

const EMPTY: Draft = {
  step: 1,
  title: "",
  location: "",
  when: "",
  formats: [],
  budget: naira(100_000),
  maxOverride: null,
  confirmOverride: null,
  repeat: "flag",
  packIds: ["naija-general", "afrobeats-classics"],
};

const toIso = (local: string) => {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export function NewEpisode() {
  const router = useRouter();
  const { ctx, refresh } = useStudioState();
  const [ready, setReady] = useState(false);
  const [d, setD] = useState<Draft>(EMPTY);
  const [nextNumber, setNextNumber] = useState(1);
  const [customCount, setCustomCount] = useState(0);
  const [editing, setEditing] = useState<"budget" | "max" | "confirm" | null>(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creatorId = ctx?.creator.id;

  useEffect(() => {
    if (!creatorId) return;
    let alive = true;
    (async () => {
      const [eps, summary, custom] = await Promise.all([
        listEpisodes(creatorId).catch(() => [] as Episode[]),
        getWalletSummary(creatorId).catch(() => null),
        listCustomQuestions(creatorId).catch(() => []),
      ]);
      if (!alive) return;
      let draft: Draft | null = null;
      try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (raw) draft = { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) };
        if (draft) draft.step = Math.min(draft.step, STEP_TITLE.length);
      } catch {
        /* no storage */
      }
      const free = summary?.free ?? 0;
      setD(draft ?? { ...EMPTY, budget: free >= naira(10_000) ? Math.floor(free / naira(10_000)) * naira(10_000) : EMPTY.budget });
      setNextNumber(Math.max(eps.length, ...eps.map((e) => e.number ?? 0)) + 1);
      setCustomCount(custom.length);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [creatorId]);

  const update = (patch: Partial<Draft>) =>
    setD((prev) => {
      const next = { ...prev, ...patch };
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      } catch {
        /* no storage */
      }
      return next;
    });

  if (!ctx || !ready)
    return (
      <main className="theme-paper flex flex-1 flex-col">
        <Spinner />
      </main>
    );

  const ordered = PLAN_ORDER.filter((f) => d.formats.includes(f));
  const plan = splitBudget(d.budget, ordered);
  const maxPayout = d.maxOverride ?? maxPrize(plan);
  const confirmAbove = d.confirmOverride ?? defaultConfirmAbove(maxPayout);
  const hasQuiz = d.formats.some((f) => QUIZ.includes(f));
  const hasMusic = d.formats.some((f) => MUSIC.includes(f));
  const relevantPacks = d.packIds.filter(
    (id) => (hasQuiz && QUESTION_PACKS.some((p) => p.id === id)) || (hasMusic && SONG_PACKS.some((p) => p.id === id)),
  );
  const startsAt = toIso(d.when);
  const whenText = startsAt ? whenLabel(startsAt) : "";
  const pro = ctx.creator.plan === "pro";

  const go = (step: number) => {
    setError(null);
    setEditing(null);
    update({ step });
    window.scrollTo({ top: 0 });
  };

  const next = () => {
    if (d.step === 1) {
      if (!d.title.trim()) return setError("Give the episode a name.");
      if (!d.formats.length) return setError("Pick at least one format.");
    }
    if (d.step === 2) {
      if (d.budget <= 0) return setError("Set a budget for the day.");
      if (maxPayout <= 0) return setError("Set a max per payout.");
    }
    go(d.step + 1);
  };

  const contentError = () => {
    const qs = d.packIds.some((id) => QUESTION_PACKS.some((p) => p.id === id));
    const songs = d.packIds.some((id) => SONG_PACKS.some((p) => p.id === id));
    if (hasQuiz && !qs && customCount === 0) return "Pick at least one question pack.";
    if (hasMusic && !songs) return "Pick at least one song pack.";
    return null;
  };

  const togglePack = (id: string) => update({ packIds: d.packIds.includes(id) ? d.packIds.filter((x) => x !== id) : [...d.packIds, id] });

  const startEdit = (field: "budget" | "max" | "confirm", value: Kobo) => {
    setEditing(field);
    setEditText(String(toNaira(value)));
  };
  const commitEdit = () => {
    const v = parseNairaInput(editText);
    if (v === null || v < 0) return setError("Enter an amount like 500,000 or 500k.");
    setError(null);
    if (editing === "budget") update({ budget: v, maxOverride: null, confirmOverride: null });
    if (editing === "max") update({ maxOverride: v });
    if (editing === "confirm") update({ confirmOverride: v });
    setEditing(null);
  };

  const save = async () => {
    const problem = contentError();
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const episode = await createEpisode({
        creatorId: ctx.creator.id,
        title: d.title,
        location: d.location,
        startsAt,
        formats: ordered,
        packIds: relevantPacks,
        budget: d.budget,
        formatPlan: plan,
        maxPayout,
        confirmAbove,
        repeatPolicy: d.repeat,
      });
      if (!ctx.creator.default_episode_id) await setDefaultEpisode(ctx.creator.id, episode.id).catch(() => {});
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* no storage */
      }
      void refresh();
      router.push(`/studio/episodes/${episode.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const editor = (onDark = false) => (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        commitEdit();
      }}
    >
      <Input
        tone={onDark ? "dark" : "light"}
        mono
        autoFocus
        inputMode="decimal"
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onBlur={commitEdit}
        className="!h-[48px] w-36 !px-3 text-right !text-[18px]"
        aria-label="Amount in naira"
      />
    </form>
  );

  const cta: Record<number, ReactNode> = {
    1: "NEXT: BUDGET",
    2: "NEXT: QUESTIONS",
  };

  return (
    <main className="theme-paper flex flex-1 flex-col">
      <PhoneColumn>
        <TopBar
          back={d.step === 1 ? "/studio" : () => go(d.step - 1)}
          close={d.step === 1}
          title={STEP_TITLE[d.step - 1]}
          right={`${d.step} of ${STEP_TITLE.length}`}
        />
        <div className="flex flex-1 flex-col px-7 pt-6 pb-[calc(env(safe-area-inset-bottom)+20px)]">
          {d.step === 1 && (
            <>
              <label className="block">
                <Label className="mb-2.5">Name</Label>
                <span className="flex h-[60px] items-center rounded-[14px] border-[3px] border-ink bg-card px-5 text-[22px] font-bold">
                  <span className="shrink-0 whitespace-pre">Ep {nextNumber} · </span>
                  <input
                    value={d.title}
                    onChange={(e) => update({ title: e.target.value })}
                    placeholder="Yaba Market"
                    className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:font-normal placeholder:text-muted/60"
                    aria-label="Episode name"
                  />
                </span>
              </label>
              <div className="mt-5 grid grid-cols-[1.15fr_1fr] gap-3">
                <label className="block min-w-0">
                  <Label className="mb-2.5">Where</Label>
                  <Input value={d.location} onChange={(e) => update({ location: e.target.value })} placeholder="Yaba, Lagos" className="!px-4" />
                </label>
                <label className="relative block min-w-0">
                  <Label className="mb-2.5">When</Label>
                  <span className="flex h-[60px] items-center rounded-[14px] border-[3px] border-ink bg-card px-4 text-[22px] font-bold">
                    {whenText || <span className="font-normal text-muted/60">Pick time</span>}
                  </span>
                  <input
                    type="datetime-local"
                    value={d.when}
                    onChange={(e) => update({ when: e.target.value })}
                    className="absolute inset-x-0 bottom-0 h-[60px] w-full opacity-0"
                    aria-label="When"
                  />
                </label>
              </div>

              <div className="mt-8 flex items-baseline justify-between">
                <Headline as="h2" className="text-[clamp(40px,12vw,52px)]">
                  Formats
                </Headline>
                <span className="font-mono text-[16px]">{d.formats.length} picked</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {MVP_FORMATS.map((f) => {
                  const on = d.formats.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => update({ formats: on ? d.formats.filter((x) => x !== f.id) : [...d.formats, f.id], maxOverride: null, confirmOverride: null })}
                      className={`flex min-h-[112px] flex-col justify-between rounded-[14px] px-4 py-3.5 text-left ${on ? "bg-ink text-yellow" : "border-[3px] border-ink bg-card text-ink"}`}
                    >
                      <span className={`font-mono text-[15px] ${on ? "" : "opacity-70"}`}>
                        {on ? "✓ " : ""}
                        {FORMAT_CATEGORY[f.id]}
                      </span>
                      <span className="font-wide text-[21px] leading-[1.1]">{f.name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {d.step === 2 && (
            <>
              <Caption>Total for the day</Caption>
              <div className="mt-2 flex items-end justify-between gap-3 border-b-[3px] border-ink pb-2">
                {editing === "budget" ? (
                  <form
                    className="flex-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      commitEdit();
                    }}
                  >
                    <Input big mono autoFocus inputMode="decimal" value={editText} onChange={(e) => setEditText(e.target.value)} onBlur={commitEdit} aria-label="Total budget in naira" />
                  </form>
                ) : (
                  <>
                    <p className="font-display tabular text-[clamp(64px,22vw,110px)] leading-[0.95]">{formatNaira(d.budget)}</p>
                    <button type="button" onClick={() => startEdit("budget", d.budget)} className="min-h-[44px] shrink-0 font-mono text-[16px] opacity-70">
                      ✎ Edit
                    </button>
                  </>
                )}
              </div>

              <Caption className="mt-6">Split per format · auto</Caption>
              <div className="mt-3 space-y-3">
                {ordered.map((f) => {
                  const e = plan[f];
                  if (!e) return null;
                  return (
                    <div key={f}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-wide text-[19px]">{FORMATS[f].name}</span>
                        <span className="font-mono text-[18px] font-semibold tabular">{formatNaira(e.amount)}</span>
                      </div>
                      <Bar value={d.budget ? e.amount / d.budget : 0} className="mt-2" />
                      <p className="mt-1.5 font-mono text-[14px] opacity-70">{planDetail(f, e)}</p>
                    </div>
                  );
                })}
              </div>

              <Ticket className="mt-6" bodyClassName="space-y-1 px-6 py-5">
                <Caption className="mb-2 text-yellow">Safety limits</Caption>
                <LimitRow label="Max per payout">
                  {editing === "max" ? (
                    editor(true)
                  ) : (
                    <button type="button" onClick={() => startEdit("max", maxPayout)} className="min-h-[44px] font-mono text-[20px] tabular">
                      {formatNaira(maxPayout)}
                    </button>
                  )}
                </LimitRow>
                <LimitRow label="Hold to send above">
                  {editing === "confirm" ? (
                    editor(true)
                  ) : (
                    <button type="button" onClick={() => startEdit("confirm", confirmAbove)} className="min-h-[44px] font-mono text-[20px] tabular">
                      {formatNaira(confirmAbove)}
                    </button>
                  )}
                </LimitRow>
                <LimitRow label="Repeat winners">
                  <button
                    type="button"
                    onClick={() => update({ repeat: REPEAT[(REPEAT.indexOf(d.repeat) + 1) % REPEAT.length] })}
                    className="min-h-[44px] font-mono text-[20px]"
                    aria-label={`Repeat winners: ${REPEAT_LABEL[d.repeat]}. Tap to change.`}
                  >
                    {REPEAT_LABEL[d.repeat]}
                  </button>
                </LimitRow>
              </Ticket>
            </>
          )}

          {d.step === 3 && (
            <>
              {hasQuiz && (
                <>
                  <Headline as="h2" className="text-[clamp(40px,12vw,52px)]">
                    Question packs
                  </Headline>
                  <div className="mt-4 space-y-2.5">
                    {QUESTION_PACKS.map((p) => {
                      const on = d.packIds.includes(p.id);
                      const locked = p.premium && !pro;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={locked}
                          aria-pressed={on}
                          onClick={() => togglePack(p.id)}
                          className={`flex min-h-[60px] w-full items-center gap-4 rounded-[14px] px-5 text-left ${on ? "bg-ink text-yellow" : "border-2 border-ink bg-card text-ink"} ${locked ? "opacity-70" : ""}`}
                        >
                          <span aria-hidden className={`size-7 shrink-0 rounded-md ${on ? "bg-yellow" : "border-2 border-ink"}`} />
                          <span className="font-wide flex-1 text-[19px]">{p.title}</span>
                          <span className="font-mono text-[15px]">{locked ? "PRO" : `${p.items.length} Qs`}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {hasMusic && (
                <>
                  <Headline as="h2" className={`text-[clamp(40px,12vw,52px)] ${hasQuiz ? "mt-8" : ""}`}>
                    Song packs
                  </Headline>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    {SONG_PACKS.map((p) => (
                      <Chip key={p.id} selected={d.packIds.includes(p.id)} onClick={() => (p.premium && !pro ? undefined : togglePack(p.id))}>
                        {p.title}
                        {p.premium && !pro ? " · PRO" : ""}
                      </Chip>
                    ))}
                  </div>
                  <p className="mt-4 text-[17px] leading-snug opacity-80">
                    Song cards hold the title, artist and cue time only. Play the music from your own phone or speaker.
                  </p>
                </>
              )}
              {!hasQuiz && !hasMusic && (
                <p className="text-[18px] leading-snug">Chance games need no packs. The wheel and the boxes are set from your budget.</p>
              )}
              {hasQuiz && (
                <Link
                  href="/studio/packs"
                  className="mt-5 flex min-h-[60px] items-center justify-between rounded-[14px] border-[3px] border-dashed border-ink px-6"
                >
                  <span className="font-wide text-[19px]">+ Write your own</span>
                  <span className="font-mono text-[15px] font-semibold">{customCount} added</span>
                </Link>
              )}

              <Ticket
                tone="yellow"
                outline
                className="mt-8"
                bodyClassName="px-6 pt-5 pb-5"
                stubClassName="space-y-1 px-6 py-4 font-mono text-[16px]"
                stub={
                  <>
                    <p>✓ Downloaded for offline</p>
                    <p>✓ Fair-play seeds locked</p>
                  </>
                }
              >
                <Caption>Ready to play</Caption>
                <Headline as="p" className="mt-2 text-[clamp(44px,13vw,60px)] break-words">
                  Ep {nextNumber} · {d.title}
                </Headline>
                <p className="mt-4 font-mono text-[16px]">
                  {d.formats.length} {d.formats.length === 1 ? "format" : "formats"} · {relevantPacks.length} {relevantPacks.length === 1 ? "pack" : "packs"} ·{" "}
                  {formatNaira(d.budget)}
                </p>
              </Ticket>
            </>
          )}

          <div className="mt-auto space-y-3 pt-8">
            <ErrorText>{error}</ErrorText>
            {d.step < STEP_TITLE.length ? (
              <Button onClick={next}>
                {cta[d.step]} <Arrow />
              </Button>
            ) : (
              <Button onClick={save} loading={busy}>
                {startsAt ? `SAVE · START AT ${whenText.split(" ").pop()}` : "SAVE EPISODE"}
              </Button>
            )}
          </div>
        </div>
      </PhoneColumn>
    </main>
  );
}

function LimitRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-paper">
      <span className="text-[18px]">{label}</span>
      {children}
    </div>
  );
}
