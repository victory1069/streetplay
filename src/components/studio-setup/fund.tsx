"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Arrow, ButtonLink, Caption, ErrorText, Headline, PhoneColumn, Spinner, Ticket, TopBar } from "@/components/ui";
import { share, useCopy } from "@/components/ui/interactive";
import { useStudioState } from "@/components/studio/studio-context";
import { latestFunding, setDefaultEpisode, simulateTransferIn, subscribeToWallet } from "@/lib/data/studio";
import { listEpisodes } from "@/lib/data/episodes";
import { appUrl } from "@/lib/format";
import type { Episode } from "@/types/domain";
import { episodeLabel, errorMessage } from "./shared";
import { OnboardingHeader } from "./onboarding";

const group = (n: string) => (n.length === 10 ? `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}` : n);

export function Fund() {
  const router = useRouter();
  // ?setup=1: this is step 3 of onboarding, so it can be skipped.
  const setup = useSearchParams().get("setup") === "1";
  const { ctx, refresh } = useStudioState();
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [copied, copy] = useCopy();
  const [simAvailable, setSimAvailable] = useState(false);
  const [simBusy, setSimBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openedAt = useRef<string | null>(null);
  const creatorId = ctx?.creator.id;

  useEffect(() => {
    if (!creatorId) return;
    let alive = true;
    openedAt.current ??= new Date().toISOString();
    listEpisodes(creatorId)
      .then((eps) => alive && setEpisodes(eps.filter((e) => e.status !== "wrapped")))
      .catch(() => alive && setEpisodes([]));
    const unsubscribe = subscribeToWallet(creatorId, async () => {
      const since = openedAt.current!;
      const hit = await latestFunding(creatorId, since).catch(() => null);
      if (hit && alive) router.push(`/studio/wallet/funded?since=${encodeURIComponent(since)}`);
    });
    // Mock provider only: the simulate route answers 400 to an empty amount; with real money it's 404.
    fetch("/api/wallet/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then((res) => alive && setSimAvailable(res.status !== 404))
      .catch(() => {});
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [creatorId, router]);

  if (!ctx)
    return (
      <main className="theme-paper flex flex-1 flex-col">
        <Spinner />
      </main>
    );

  const c = ctx.creator;
  const selected = episodes?.find((e) => e.id === c.default_episode_id) ?? episodes?.[0] ?? null;

  const assign = async (id: string) => {
    setError(null);
    try {
      await setDefaultEpisode(c.id, id || null);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <main className="theme-paper flex flex-1 flex-col">
      <PhoneColumn>
        {setup ? <OnboardingHeader step={3} title="Fund wallet" back="/studio/kyc" /> : <TopBar back="/studio/wallet" title="Fund wallet" />}
        <div className="flex flex-1 flex-col px-7 pt-6 pb-[calc(env(safe-area-inset-bottom)+20px)]">
          <Headline className="text-[clamp(40px,12vw,56px)] leading-[0.9]">Send any amount to your StreetPlay account.</Headline>

          {c.virtual_account_number ? (
            <Ticket
              className="mt-6"
              bodyClassName="px-6 pt-6 pb-8"
              stubClassName="grid grid-cols-2 gap-2.5 px-5 py-4"
              stub={
                <>
                  <button
                    type="button"
                    onClick={() => copy(c.virtual_account_number!)}
                    className="font-wide min-h-[52px] rounded-[10px] bg-yellow px-2 text-[clamp(14px,4.2vw,17px)] whitespace-nowrap text-ink"
                    aria-live="polite"
                  >
                    {copied ? "Copied ✓" : "Copy number"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void share({
                        title: "StreetPlay account",
                        text: `${c.virtual_account_number} · ${c.virtual_account_bank ?? ""} · ${c.virtual_account_name ?? ""}`,
                      })
                    }
                    className="font-wide min-h-[52px] rounded-[10px] border-2 border-smoke px-2 text-[clamp(14px,4.2vw,17px)] whitespace-nowrap text-paper"
                  >
                    Share details
                  </button>
                </>
              }
            >
              <Caption className="opacity-80">Account number</Caption>
              <p className="mt-3 font-mono text-[clamp(26px,8.6vw,46px)] leading-none font-semibold whitespace-nowrap text-yellow tabular">
                {group(c.virtual_account_number)}
              </p>
              {c.virtual_account_bank && <p className="font-wide mt-4 text-[19px]">{c.virtual_account_bank}</p>}
              {c.virtual_account_name && <p className="mt-1 text-[17px] opacity-80">{c.virtual_account_name}</p>}
            </Ticket>
          ) : c.kyc_status !== "verified" ? (
            <Ticket className="mt-6" bodyClassName="p-6">
              <p className="font-wide text-[22px] leading-tight">Open your wallet first</p>
              <p className="mt-2 text-[17px] leading-snug opacity-80">Two minutes of checks, then you get your own account number.</p>
              <ButtonLink href="/studio/kyc" variant="yellow" size="md" font="bold" className="mt-5">
                Open your wallet <Arrow />
              </ButtonLink>
            </Ticket>
          ) : (
            <Ticket className="mt-6" bodyClassName="p-6">
              <p className="font-wide text-[22px] leading-tight">Your account number is on its way</p>
              <p className="mt-2 text-[17px] leading-snug opacity-80">The bank is creating it. Check back in a few minutes.</p>
            </Ticket>
          )}

          {episodes && episodes.length > 0 && (
            <label className="relative mt-4 block rounded-[14px] border-[3px] border-ink bg-card px-6 py-3">
              <span className="font-label block">Assign to</span>
              <select
                value={selected?.id ?? ""}
                onChange={(e) => void assign(e.target.value)}
                className="font-wide w-full appearance-none bg-transparent pr-8 text-[20px] outline-none"
              >
                {episodes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {episodeLabel(e)}
                  </option>
                ))}
              </select>
              <span aria-hidden className="pointer-events-none absolute top-1/2 right-6 -translate-y-1/2 text-xs">
                ▼
              </span>
            </label>
          )}
          <div className="mt-3">
            <ErrorText>{error}</ErrorText>
          </div>

          <div className="mt-auto pt-8">
            <div className="rounded-[14px] border-[3px] border-ink bg-yellow px-6 py-5">
              <p className="font-wide text-[21px] leading-tight">Sponsor paying for the prizes?</p>
              <p className="mt-2 text-[18px] leading-snug">Send a funding link. It&apos;s tagged to this episode.</p>
              {selected ? (
                <button
                  type="button"
                  onClick={() =>
                    void share({
                      title: `Fund ${episodeLabel(selected)}`,
                      text: `Fund the prizes for ${episodeLabel(selected)} on StreetPlay`,
                      url: appUrl(`/fund/${selected.public_code}`),
                    })
                  }
                  className="font-wide mt-4 min-h-[44px] text-[19px] underline underline-offset-4"
                >
                  Create sponsor link →
                </button>
              ) : (
                <Link href="/studio/episodes/new" className="font-wide mt-4 inline-block min-h-[44px] text-[19px] underline underline-offset-4">
                  Plan an episode first →
                </Link>
              )}
            </div>
            <p className="mt-4 text-center font-mono text-[14px] opacity-70">Usually lands within a minute. We&apos;ll notify you.</p>
            {simAvailable && c.virtual_account_number && (
              <button
                type="button"
                disabled={simBusy}
                onClick={async () => {
                  setSimBusy(true);
                  setError(null);
                  try {
                    await simulateTransferIn(50_000_000);
                  } catch (err) {
                    if (errorMessage(err) === "Not found.") setSimAvailable(false);
                    else setError(errorMessage(err));
                  } finally {
                    setSimBusy(false);
                  }
                }}
                className="mt-4 min-h-[44px] w-full rounded-[10px] border-2 border-dashed border-muted font-mono text-[14px] opacity-80 disabled:opacity-40"
              >
                {simBusy ? "Sending…" : "Test: simulate a ₦500,000 transfer"}
              </button>
            )}
            {setup && (
              <ButtonLink href="/studio" variant="outline" className="mt-4">
                Skip for now <Arrow />
              </ButtonLink>
            )}
          </div>
        </div>
      </PhoneColumn>
    </main>
  );
}
