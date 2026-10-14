"use client";

import { useEffect, useRef, useState } from "react";
import { useOffline } from "next/offline";
import { Spinner } from "@/components/ui";
import {
  getCurrentPrompt,
  getLeaderboard,
  getLiveSession,
  getMyStanding,
  getPromptStats,
  joinLive,
  respond,
  subscribeToCreator,
  subscribeToPrompts,
} from "@/lib/data/live";
import type { FanStanding, LeaderboardRow, LivePrompt, LiveSession, PromptStats } from "@/types/domain";
import { PlayHeader, ShakyStrip, Sidebar } from "./chrome";
import { firstName, store, useCountdown, useNow } from "./hooks";
import { InstallSheet } from "./install-sheet";
import { JoinScreen, NotLiveScreen } from "./join";
import { PredictScreen, QuizScreen, ResultScreen, TextScreen, VoteScreen, WaitingScreen, type Answer, type PromptProps } from "./screens";

// /play/[handle]: the viewer game. One page follows the creator's Live:
// waiting → vote / predict / quiz / name-the-song → result → waiting.
// Realtime pushes new prompts; light polling covers everything else (and
// covers Realtime when Instagram's browser drops the socket).

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

const newer = (prev: LivePrompt | null, p: LivePrompt) =>
  !prev || p.id === prev.id || Date.parse(p.opened_at) >= Date.parse(prev.opened_at) ? p : prev;

const status = (e: unknown) => (e as { status?: number }).status;

export function PlayApp({ initial }: { initial: LiveSession }) {
  const handle = initial.handle;
  const answersKey = `sp:play:${handle}:answers`;

  const [session, setSession] = useState(initial);
  const [me, setMe] = useState<FanStanding | null>(null);
  const [joined, setJoined] = useState<"unknown" | "yes" | "no">("unknown");
  const [prompt, setPrompt] = useState<LivePrompt | null>(null);
  const [stats, setStats] = useState<{ id: string; s: PromptStats } | null>(null);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [netFail, setNetFail] = useState(false);
  const [sheet, setSheet] = useState(false);
  const offline = useOffline();
  const now = useNow(1000);

  const answersRef = useRef(answers);
  const inflight = useRef(new Set<string>());
  const installEvent = useRef<BeforeInstallPromptEvent | null>(null);
  const joinedRef = useRef(joined);
  const sendRef = useRef<(id: string, a: Answer) => Promise<void>>(async () => {});

  useEffect(() => {
    joinedRef.current = joined;
    sendRef.current = send;
  });

  useEffect(() => {
    answersRef.current = answers;
    if (joined !== "yes") return;
    const recent = Object.fromEntries(Object.entries(answers).slice(-15));
    store.set(answersKey, recent);
  }, [answers, joined, answersKey]);

  // Who is this browser? 401 → join screen.
  const live = session.status === "live";
  useEffect(() => {
    let alive = true;
    getMyStanding(handle)
      .then((s) => {
        if (!alive) return;
        setMe(s);
        setJoined("yes");
        setAnswers(store.get<Record<string, Answer>>(answersKey) ?? {});
      })
      .catch((e) => {
        if (!alive) return;
        if (status(e) === 401) setJoined("no");
        else setNetFail(true);
      });
    return () => {
      alive = false;
    };
  }, [handle, answersKey]);

  // Every 10s: session (players, waiting info), current prompt, board, standing.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const s = await getLiveSession(handle);
        if (!alive || !s) return;
        setSession(s);
        const jobs: Promise<unknown>[] = [];
        if (s.episode_id && s.status === "live") {
          jobs.push(getCurrentPrompt(s.episode_id).then((p) => alive && p && setPrompt((prev) => newer(prev, p))));
          jobs.push(getLeaderboard(s.creator_id, s.episode_id, "live", 8).then((rows) => alive && setBoard(rows)));
        }
        jobs.push(
          getMyStanding(handle).then(
            (m) => {
              if (!alive) return;
              setMe(m);
              if (joinedRef.current !== "yes") setAnswers(store.get<Record<string, Answer>>(answersKey) ?? {});
              setJoined("yes");
            },
            (e) => {
              if (alive && status(e) === 401) setJoined("no");
              else throw e;
            },
          ),
        );
        await Promise.all(jobs);
        if (alive) setNetFail(false);
      } catch {
        if (alive) setNetFail(true);
      }
    };
    const t = window.setInterval(tick, 10_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [handle, answersKey]);

  // Prompts: first load + Realtime.
  const episodeId = live ? session.episode_id : null;
  useEffect(() => {
    if (!episodeId) return;
    let alive = true;
    getCurrentPrompt(episodeId)
      .then((p) => alive && p && setPrompt((prev) => newer(prev, p)))
      .catch(() => alive && setNetFail(true));
    getLeaderboard(initial.creator_id, episodeId, "live", 8)
      .then((rows) => alive && setBoard(rows))
      .catch(() => {});
    const off = subscribeToPrompts(episodeId, (p) => setPrompt((prev) => newer(prev, p)));
    return () => {
      alive = false;
      off();
    };
  }, [episodeId, initial.creator_id]);

  // Prompt timing.
  const promptOpen = !!prompt && prompt.status === "open" && (!prompt.closes_at || Date.parse(prompt.closes_at) > now);
  const endedAt = prompt ? Date.parse(prompt.resolved_at ?? prompt.closes_at ?? prompt.opened_at) : 0;
  const recent = !!prompt && !promptOpen && now - endedAt < 30_000;
  const pollStats = promptOpen || recent;
  const secondsLeft = useCountdown(prompt?.closes_at);

  // Vote split and answer counts every 2s while it matters.
  const promptId = prompt?.id ?? null;
  const promptStatus = prompt?.status ?? null;
  useEffect(() => {
    if (!promptId || !pollStats) return;
    let alive = true;
    const run = () =>
      getPromptStats(promptId)
        .then((s) => alive && setStats({ id: promptId, s }))
        .catch(() => {});
    void run();
    const t = window.setInterval(run, 2000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [promptId, promptStatus, pollStats]);

  // Answers that didn't reach us: retry when the network comes back.
  useEffect(() => {
    const retry = () => {
      for (const [id, a] of Object.entries(answersRef.current)) if (a.pending) void sendRef.current(id, a);
    };
    window.addEventListener("online", retry);
    const t = window.setInterval(retry, 5000);
    return () => {
      window.removeEventListener("online", retry);
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      installEvent.current = e as BeforeInstallPromptEvent;
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function send(id: string, a: Answer) {
    if (inflight.current.has(id)) return;
    inflight.current.add(id);
    try {
      const r = await respond(handle, id, { option: a.option, text: a.text, artist: a.artist });
      setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], pending: false, error: undefined, result: r } }));
      setNetFail(false);
      setMe((m) => (m ? { ...m, points: r.total } : m));
      getMyStanding(handle)
        .then(setMe)
        .catch(() => {});
      if (!store.get("sp:install-asked")) {
        store.set("sp:install-asked", true);
        setSheet(true);
      }
    } catch (e) {
      const s = status(e);
      if (!s || s >= 500 || s === 429) setNetFail(true);
      else {
        setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], pending: false, error: (e as Error).message } }));
        if (s === 401) setJoined("no");
      }
    } finally {
      inflight.current.delete(id);
    }
  }

  function answer(p: LivePrompt, a: Answer) {
    if (answersRef.current[p.id]) return; // first answer counts
    const entry: Answer = { ...a, pending: true, rankBefore: me?.rank };
    answersRef.current = { ...answersRef.current, [p.id]: entry };
    setAnswers((prev) => ({ ...prev, [p.id]: entry }));
    navigator.vibrate?.(20);
    void send(p.id, entry);
  }

  async function install() {
    const ev = installEvent.current;
    if (ev) {
      await ev.prompt().catch(() => {});
      installEvent.current = null;
    }
    await subscribeToCreator(handle).catch(() => false);
  }

  const shaky = offline || netFail;

  if (!live) return <NotLiveScreen session={session} />;

  if (joined === "no") {
    return (
      <JoinScreen
        session={session}
        onJoin={async (name) => {
          const s = await joinLive(handle, name);
          setMe(s);
          setAnswers(store.get<Record<string, Answer>>(answersKey) ?? {});
          setJoined("yes");
        }}
      />
    );
  }

  if (joined === "unknown") {
    return (
      <main className="theme-yellow flex flex-1 flex-col">
        <PlayHeader session={session} />
        <div className="px-5 pt-5 lg:px-14">{shaky && <ShakyStrip />}</div>
        <Spinner label="Joining" />
      </main>
    );
  }

  // Which screen?
  const host = firstName(session.creator_name);
  const ans = prompt ? answers[prompt.id] : undefined;
  const state = session.live_state;
  const announcedAfter = (p: LivePrompt) => !!state?.starts_at && Date.parse(state.starts_at) - 30_000 > Date.parse(p.opened_at);
  let view: "prompt" | "result" | "waiting" = "waiting";
  if (prompt && prompt.episode_id === session.episode_id) {
    if (promptOpen) view = "prompt";
    else if (prompt.kind === "predict" && ans && prompt.status === "resolved" && now - endedAt < 90_000) view = "result";
    else if (prompt.kind === "predict" && ans && prompt.status !== "resolved" && !announcedAfter(prompt)) view = "prompt";
    else if (recent) view = "prompt";
  }
  const dark = view === "prompt" && prompt?.kind === "text";

  let screen;
  if (view === "prompt" && prompt) {
    const props: PromptProps = {
      prompt,
      answer: ans,
      stats: stats?.id === prompt.id ? stats.s : null,
      secondsLeft: promptOpen ? secondsLeft : prompt.closes_at ? 0 : null,
      open: promptOpen,
      host,
      onAnswer: (a) => answer(prompt, a),
    };
    screen =
      prompt.kind === "vote" ? (
        <VoteScreen {...props} />
      ) : prompt.kind === "predict" ? (
        <PredictScreen key={prompt.id} {...props} />
      ) : prompt.kind === "quiz" ? (
        <QuizScreen {...props} />
      ) : (
        <TextScreen key={prompt.id} {...props} />
      );
  } else if (view === "result" && prompt && ans) {
    screen = (
      <ResultScreen
        prompt={prompt}
        answer={ans}
        stats={stats?.id === prompt.id ? stats.s : null}
        me={me}
        nextStartsAt={state?.starts_at ?? null}
      />
    );
  } else {
    screen = <WaitingScreen state={state} me={me} host={host} />;
  }

  return (
    <main className={`${dark ? "theme-ink" : "theme-yellow"} flex min-h-dvh flex-1 flex-col`}>
      <PlayHeader session={session} me={me} dark={dark} />
      <div className="flex flex-1">
        <section className="mx-auto flex w-full max-w-[460px] flex-1 flex-col gap-5 px-5 pt-5 pb-6 lg:max-w-none lg:px-14 lg:pt-10 lg:pb-10">
          {shaky && <ShakyStrip />}
          {screen}
        </section>
        {view !== "result" && <Sidebar rows={board} me={me} handle={handle} dark={dark} />}
      </div>
      {sheet && <InstallSheet handle={handle} onInstall={install} onClose={() => setSheet(false)} />}
    </main>
  );
}
