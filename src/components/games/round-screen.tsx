"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Arrow, Button, ButtonLink, Caption, ErrorText, Headline, Input, PhoneColumn, Spinner, Ticket } from "@/components/ui";
import { Sheet } from "@/components/ui/interactive";
import { useStudio } from "@/components/studio/studio-context";
import { endRound, getEpisode, getRound, recordConsent, saveRoundProgress, startRound } from "@/lib/data/episodes";
import { listCustomQuestions } from "@/lib/data/studio";
import { cached } from "@/lib/offline/idb";
import { FORMATS } from "@/lib/games/formats";
import { formatNaira } from "@/lib/money";
import { questionsFor, QUESTION_PACKS } from "@/content";
import type { Episode, FormatId, Kobo, Question, Round } from "@/types/domain";
import { planFor, PLAYABLE, prizeCapFor, rulesFor, type RuleIcon } from "./rules";
import type { EndStatus, GameProps } from "./shared";
import { FinishTheLyric, NameTheSong } from "./song-games";
import { MoneyLadder, QuickfireTrivia } from "./question-games";
import { PickABox, SpinTheWheel } from "./chance-games";

type Stage = "loading" | "missing" | "consent" | "rules" | "play" | "lost";

/** Consent → rules → game → result, for one round. Resumes from IndexedDB after a refresh. */
export function RoundScreen({ episodeId, roundId }: { episodeId: string; roundId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const studio = useStudio();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stage, setStage] = useState<Stage>("loading");
  const consoleHref = `/studio/episodes/${episodeId}`;
  const payoutHref = (amount: Kobo) => `/studio/episodes/${episodeId}/rounds/${roundId}/payout?amount=${amount}`;

  const creatorId = studio?.creator.id;
  useEffect(() => {
    if (!creatorId) return;
    let alive = true;
    (async () => {
      const [ep, r, custom] = await Promise.all([
        getEpisode(episodeId).catch(() => null),
        getRound(roundId).catch(() => null),
        cached(`custom-questions:${creatorId}`, () => listCustomQuestions(creatorId)).catch(() => [] as Question[]),
      ]);
      if (!alive) return;
      setEpisode(ep);
      setRound(r);
      if (ep) {
        const qs = questionsFor(ep.pack_ids, custom);
        setQuestions(qs.length ? qs : questionsFor(QUESTION_PACKS.map((p) => p.id), custom));
      }
      if (!ep) setStage("missing");
      else if (!r) setStage("consent");
      else if (r.status === "playing" || r.status === "setup") setStage((r.result as { stage?: string }).stage === "play" ? "play" : "rules");
      else if (r.prize_won > 0) router.replace(payoutHref(r.prize_won));
      else setStage("lost");
    })();
    return () => {
      alive = false;
    };
    // Load once per round.
  }, [creatorId, episodeId, roundId]); // eslint-disable-line react-hooks/exhaustive-deps

  const qFormat = search.get("format") as FormatId | null;
  const format: FormatId | null = round?.format ?? (qFormat && PLAYABLE.includes(qFormat) ? qFormat : null);
  const roundNumber = round?.number ?? (Number(search.get("n")) || null);

  if (stage === "loading" || !studio) {
    return (
      <main className="theme-ink flex flex-1 flex-col">
        <Spinner />
      </main>
    );
  }
  if (stage === "missing" || !episode || !format) {
    return (
      <main className="theme-ink flex flex-1 flex-col">
        <PhoneColumn className="gap-6 px-7 py-10">
          <Headline className="text-[48px]">Round not found.</Headline>
          <p className="text-[17px] text-paper/80">We couldn&apos;t load this round on this phone. Start a new one from the console.</p>
          <ButtonLink href={consoleHref} variant="yellow">
            Back to console <Arrow />
          </ButtonLink>
        </PhoneColumn>
      </main>
    );
  }

  const plan = planFor(episode, format);
  const formatName = FORMATS[format].name;

  if (stage === "consent") {
    return (
      <Consent
        onCancel={() => router.push(consoleHref)}
        onAgree={async (name) => {
          const r = await startRound({ id: roundId, episodeId, format, prizeCap: prizeCapFor(format, plan), participantName: name });
          await recordConsent(r.id, name);
          setRound(r);
          setStage("rules");
        }}
      />
    );
  }

  if (!round) return null;

  if (stage === "rules") {
    return (
      <Rules
        name={round.participant_name ?? ""}
        formatName={formatName}
        copy={rulesFor(format, plan, episode.sponsor_name)}
        topPrize={round.prize_cap}
        onReady={() => {
          void saveRoundProgress(round, { ...round.result, stage: "play" }, round.prize_won).then(setRound);
          setStage("play");
        }}
      />
    );
  }

  if (stage === "lost") {
    return (
      <main className="theme-ink flex flex-1 flex-col">
        <PhoneColumn className="px-7 pt-6 pb-[calc(env(safe-area-inset-bottom)+20px)]">
          <Caption className="text-[13px] text-paper/80">
            {roundNumber ? `R${roundNumber} · ` : ""}
            {formatName}
          </Caption>
          <Headline className="mt-6 text-[clamp(60px,20vw,92px)]">Better luck next time.</Headline>
          <p className="font-wide mt-5 text-[19px] text-paper/85">
            {round.participant_name ? `${round.participant_name} played well.` : "Good game."} No payout this round.
          </p>
          {round.summary && <p className="mt-2 font-mono text-[15px] text-paper/60">{round.summary}</p>}
          <div className="mt-auto pt-8">
            <ButtonLink href={consoleHref} variant="yellow" className="min-h-[72px] text-[34px]">
              Next round <Arrow />
            </ButtonLink>
          </div>
        </PhoneColumn>
      </main>
    );
  }

  const props: GameProps = {
    episode,
    round,
    plan,
    roundNumber,
    onSave: (result, prize) => void saveRoundProgress(round, result, prize).catch(() => {}),
    onEnd: (status: EndStatus, prize: Kobo, summary: string, result: Record<string, unknown>) => {
      const capped = Math.min(prize, round.prize_cap || prize);
      void endRound(round, status, capped, summary, result).then((r) => {
        setRound(r);
        if (capped > 0) router.replace(payoutHref(capped));
        else setStage("lost");
      });
    },
  };

  return (
    <main className="theme-ink flex flex-1 flex-col">
      <PhoneColumn>
        {format === "finish-the-lyric" && <FinishTheLyric {...props} />}
        {format === "name-the-song" && <NameTheSong {...props} />}
        {format === "money-ladder" && <MoneyLadder {...props} questions={questions} />}
        {format === "quickfire-trivia" && <QuickfireTrivia {...props} questions={questions} prizeCap={round.prize_cap} />}
        {format === "spin-the-wheel" && <SpinTheWheel {...props} />}
        {format === "pick-a-box" && <PickABox {...props} />}
      </PhoneColumn>
    </main>
  );
}

// ---------------------------------------------------------------- Consent (paper)

const POINTS = [
  "You'll be filmed and the video may go on Instagram.",
  "If you win, the money goes to a bank account in your own name.",
  "We keep your name and payment record. You can ask us to delete it.",
];

function Consent({ onAgree, onCancel }: { onAgree: (name: string) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const agreeing = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [terms, setTerms] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const read = () => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(`Before we play. ${POINTS.map((p, i) => `${i + 1}. ${p}`).join(" ")}`);
    u.lang = "en-NG";
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  };

  const agree = async () => {
    // Synchronous lock: Enter + tap must start exactly one round (one seed).
    if (!name.trim() || agreeing.current) return;
    agreeing.current = true;
    setBusy(true);
    setError(null);
    window.speechSynthesis?.cancel();
    try {
      await onAgree(name.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the round.");
      setBusy(false);
      agreeing.current = false;
    }
  };

  return (
    <main className="theme-paper flex flex-1 flex-col">
      <PhoneColumn className="px-7 pt-8 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <div className="flex items-center justify-between gap-3">
          <Caption className="text-[13px]">Before we play</Caption>
          <button
            type="button"
            onClick={read}
            aria-pressed={speaking}
            className="font-wide inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 border-ink px-4 text-[16px]"
          >
            <span aria-hidden>{speaking ? "■" : "▶"}</span>
            {speaking ? "Stop" : "Read it to me"}
          </button>
        </div>
        <label htmlFor="participant-name">
          <Headline className="mt-5 text-[clamp(56px,18vw,80px)]" as="h1">
            What&apos;s your name?
          </Headline>
        </label>
        <Input
          id="participant-name"
          big
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="go"
          onKeyDown={(e) => e.key === "Enter" && void agree()}
          className="mt-5 h-[56px]"
          placeholder="First name"
        />
        <ol className="mt-6 flex flex-col gap-4">
          {POINTS.map((p, i) => (
            <li key={i} className="flex gap-4 text-[17px] leading-[1.4]">
              <span className="font-display w-4 shrink-0 text-[26px] leading-[0.95]">{i + 1}</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => setTerms(true)} className="mt-4 self-start text-[15px] underline underline-offset-4">
          Full prize terms
        </button>
        <div className="mt-auto pt-8">
          <ErrorText>{error}</ErrorText>
          <Button variant="ink" onClick={agree} loading={busy} disabled={!name.trim()} className="mt-2 min-h-[72px] text-[34px]">
            I agree · Let&apos;s play
          </Button>
          <button type="button" onClick={onCancel} className="font-wide mt-2 min-h-[48px] w-full text-[16px]">
            No thanks
          </button>
        </div>
      </PhoneColumn>
      <Sheet open={terms} onClose={() => setTerms(false)}>
        <h2 className="font-display text-[44px]">Prize terms</h2>
        <ul className="mt-4 flex list-disc flex-col gap-2.5 pl-5 text-[16px] leading-snug">
          <li>Prizes are what the host announces on camera for this round, paid once.</li>
          <li>Money goes by bank transfer to an account in the winner&apos;s own name. No account? We hold it and text a claim code, valid for 7 days.</li>
          <li>Chance games (wheel, boxes) use a result locked before play. Anyone can check it on the receipt.</li>
          <li>The host&apos;s call on answers is final. One prize per person per round.</li>
          <li>We keep your first name, consent time and payment record for the show&apos;s records. Ask the host or use the link on your receipt to delete your details.</li>
        </ul>
        <Button variant="ink" size="md" className="mt-6" onClick={() => setTerms(false)}>
          Got it
        </Button>
      </Sheet>
    </main>
  );
}

// ---------------------------------------------------------------- Rules (ink)

function Icon({ icon }: { icon: RuleIcon }) {
  const base = "grid size-[34px] shrink-0 place-items-center rounded-full";
  if (icon.kind === "check") return <span className={`${base} bg-green text-[20px] text-ink`}>✓</span>;
  if (icon.kind === "cross") return <span className={`${base} bg-red text-[20px] text-paper`}>✕</span>;
  return <span className={`${base} border-2 border-paper font-mono text-[15px] font-semibold`}>{icon.glyph}</span>;
}

function Rules({
  name,
  formatName,
  copy,
  topPrize,
  onReady,
}: {
  name: string;
  formatName: string;
  copy: ReturnType<typeof rulesFor>;
  topPrize: Kobo;
  onReady: () => void;
}) {
  const first = name.trim().split(/\s+/)[0];
  return (
    <main className="theme-ink flex flex-1 flex-col">
      <PhoneColumn className="px-7 pt-8 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <Caption className="text-[13px] text-yellow">
          {first ? `Hi ${first} · ` : ""}
          {formatName}
        </Caption>
        <Headline className="mt-4 text-[clamp(60px,20vw,92px)]">{copy.headline}</Headline>
        <ul className="mt-5 flex flex-col gap-4">
          {copy.bullets.map((b, i) => (
            <li key={i} className="flex items-center gap-3">
              <Icon icon={b.icon} />
              <span className="font-wide text-[17px] leading-tight">{b.text}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-col gap-4 pt-8">
          <Ticket tone="yellow" bodyClassName="flex items-center justify-between gap-4 px-10 py-4">
            <span className="font-label text-[12px]">Top prize</span>
            <span className="font-display tabular text-[clamp(40px,12vw,52px)]">{formatNaira(topPrize)}</span>
          </Ticket>
          <Button variant="cream" onClick={onReady} className="min-h-[72px] text-[36px]">
            I&apos;m ready
          </Button>
        </div>
      </PhoneColumn>
    </main>
  );
}

