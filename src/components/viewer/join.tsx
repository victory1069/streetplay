"use client";

import { useState } from "react";
import Link from "next/link";
import { AdmitTicket, Arrow, Button, ErrorText, Headline, Logo } from "@/components/ui";
import { subscribeToCreator } from "@/lib/data/live";
import type { LiveSession } from "@/types/domain";
import { handleLabel } from "./chrome";

// "ENTER THE GAME. NA FREE." and the not-live fallback.

export function JoinScreen({ session, onJoin }: { session: LiveSession; onJoin: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onJoin(name.trim());
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const where = session.location ? ` in ${session.location}` : "";

  return (
    <main className="theme-yellow flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col px-5 pt-10 pb-6 lg:grid lg:max-w-[1280px] lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16 lg:px-14 lg:pt-14">
        <div className="flex flex-col items-center lg:items-start">
          <AdmitTicket line="ADMIT ONE PLAYER" />
          <p className="mt-6 flex items-center gap-3 font-mono text-[16px] font-semibold lg:text-[19px]">
            <span className="size-3 rounded-full bg-red" />
            {handleLabel(session)} is live{where}
            <span className="hidden lg:inline">· {session.players.toLocaleString("en-NG")} playing</span>
          </p>
          <Headline className="mt-8 self-start text-[clamp(64px,19vw,92px)] lg:text-[150px]">ENTER THE GAME. NA FREE.</Headline>
          <p className="mt-6 self-start text-[19px] leading-snug lg:text-[26px]">
            Vote on what the stranger does, call the reveal before it happens, and win airtime or cash.
          </p>
        </div>

        <form
          className="mt-10 flex flex-col lg:mt-0 lg:rounded-[22px] lg:bg-ink lg:text-paper"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) void submit();
          }}
        >
          <div className="flex flex-col gap-5 lg:px-11 lg:pt-11 lg:pb-9">
            <p className="font-label hidden text-yellow lg:block">Your ticket</p>
            <label className="block">
              <span className="font-label mb-2.5 block">Display name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 24))}
                autoComplete="nickname"
                autoCapitalize="none"
                placeholder="tunde_k"
                className="h-[64px] w-full rounded-[14px] border-[3px] border-ink bg-card px-6 text-[26px] font-bold text-ink outline-none placeholder:font-normal placeholder:text-muted/50 lg:border-yellow lg:bg-paper"
              />
            </label>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" loading={busy} disabled={!name.trim()} className="lg:bg-yellow lg:text-ink">
              JOIN THE GAME <Arrow />
            </Button>
          </div>
          <p className="mt-5 text-center font-mono text-[14px] leading-snug lg:hidden">No sign-up. We only ask for your number if you win.</p>
          <div className="relative mx-11 hidden border-t-2 border-dashed border-smoke lg:block">
            <span aria-hidden className="absolute top-0 -left-[calc(2.75rem+14px)] size-7 -translate-y-1/2 rounded-full bg-page" />
            <span aria-hidden className="absolute top-0 -right-[calc(2.75rem+14px)] size-7 -translate-y-1/2 rounded-full bg-page" />
            <ul className="flex flex-col gap-3 py-7 text-[18px] text-paper/90">
              <li>✓ No sign-up. We only ask for your number if you win.</li>
              <li>✓ Keep the Live open on your phone. The game syncs to it.</li>
              <li>✓ Free to play. Always.</li>
            </ul>
          </div>
        </form>
      </div>
    </main>
  );
}

/** Push opt-in: "Remind me about the next Live". */
export function RemindButton({ handle, label, className = "" }: { handle: string; label: string; className?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "on" | "off">("idle");
  return (
    <div className={className}>
      <Button
        variant="outline"
        font="bold"
        size="md"
        loading={state === "busy"}
        disabled={state === "on"}
        onClick={async () => {
          setState("busy");
          const ok = await subscribeToCreator(handle).catch(() => false);
          setState(ok ? "on" : "off");
        }}
      >
        {state === "on" ? "✓ We'll ping you" : label}
      </Button>
      {state === "off" && (
        <p className="mt-2 text-[15px] leading-snug opacity-80">This browser can&apos;t do notifications. Follow @{handle} on Instagram instead.</p>
      )}
    </div>
  );
}

export function NotLiveScreen({ session }: { session: LiveSession }) {
  const first = session.creator_name.trim().split(/\s+/)[0];
  return (
    <main className="theme-yellow flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col gap-6 px-5 pt-6 pb-6 lg:max-w-[880px] lg:pt-14">
        <Logo className="self-start" />
        <Headline className="mt-6 text-[clamp(52px,15vw,76px)] lg:text-[120px]">{handleLabel(session)} isn&apos;t live right now</Headline>
        <p className="text-[19px] leading-snug lg:text-[24px]">
          The game opens when {first} goes live on Instagram. Get a ping when it starts.
        </p>
        <div className="mt-auto flex flex-col gap-4 lg:mt-6 lg:max-w-[520px]">
          <RemindButton handle={session.handle} label="Remind me about the next Live" />
          {session.episode_id && (
            <Link href={`/play/${encodeURIComponent(session.handle)}/board`} className="font-wide text-center text-[18px] underline underline-offset-4 lg:text-left">
              See the last board →
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
