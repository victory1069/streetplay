"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Arrow, Button, ButtonLink, Headline } from "@/components/ui";
import { formatNaira } from "@/lib/money";
import type { ClaimView } from "@/lib/server/views";

// /win/[code]: a viewer who placed on the Live picks how to get the prize.

export function WinChoose({ view }: { view: ClaimView }) {
  const router = useRouter();
  const [choice, setChoice] = useState<"bank" | "airtime">("bank");
  const who = view.creator_handle ? `@${view.creator_handle}` : view.creator_name;
  const amount = formatNaira(view.amount);

  if (view.status !== "held") {
    const expired = view.status === "expired";
    return (
      <Frame>
        <div className="flex flex-1 flex-col justify-center gap-6 lg:max-w-[720px]">
          <p className="font-label text-yellow">{who} · Ep {view.episode_number}</p>
          <Headline className="text-[clamp(56px,17vw,80px)] text-paper lg:text-[120px]">{expired ? "THIS PRIZE EXPIRED." : "ALREADY CLAIMED."}</Headline>
          <p className="text-[19px] text-paper/80">
            {expired
              ? "Prizes have to be claimed within 24 hours. The money went back to the host."
              : `This ${amount} prize has already been claimed.`}
          </p>
          {!expired && (
            <ButtonLink href={`/r/${view.receipt_code}`} variant="yellow">
              SEE THE RECEIPT <Arrow />
            </ButtonLink>
          )}
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="flex flex-1 flex-col lg:grid lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className="pt-10 lg:pt-0">
          <p className="font-label text-[13px] text-yellow">
            {who} picked you<span className="hidden lg:inline"> · Ep {view.episode_number}</span>
          </p>
          <h1 className="font-display mt-4 text-[clamp(80px,26vw,128px)] text-paper lg:text-[190px]">
            YOU DON WIN <span className="tabular">{amount}</span>
          </h1>
          <p className="mt-4 text-[19px] text-paper/80 lg:text-[24px]">
            You placed on the Live. Choose how you want it.
            <span className="hidden lg:inline"> Claim within 24 hours. Free, no fees.</span>
          </p>
        </div>

        <div className="mt-auto flex flex-col gap-5 pt-10 lg:mt-0 lg:pt-0" role="radiogroup" aria-label="How you want your prize">
          <Option
            selected={choice === "bank"}
            onSelect={() => setChoice("bank")}
            title="Bank transfer"
            sub="Name-checked · lands in seconds"
          />
          <Option
            selected={choice === "airtime"}
            disabled={!view.airtime_available}
            onSelect={() => setChoice("airtime")}
            title="Airtime or data"
            sub={view.airtime_available ? "MTN · Airtel · Glo · 9mobile" : "Coming soon"}
          />
          <Button variant="yellow" onClick={() => router.push(`/win/${view.code}/${choice}`)}>
            CONTINUE <Arrow />
          </Button>
          <p className="text-center font-mono text-[14px] text-paper/80 lg:hidden">Claim within 24 hours · free, no fees</p>
        </div>
      </div>
    </Frame>
  );
}

function Option({
  selected,
  disabled = false,
  onSelect,
  title,
  sub,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`relative flex min-h-[78px] items-center gap-4 rounded-[18px] px-10 py-5 text-left transition-transform disabled:opacity-50 ${
        selected ? "bg-yellow text-ink shadow-[8px_8px_0_var(--red)]" : "border-2 border-smoke bg-coal text-paper"
      }`}
    >
      <span aria-hidden className="absolute top-1/2 -left-3.5 size-7 -translate-y-1/2 rounded-full bg-page" />
      <span aria-hidden className="absolute top-1/2 -right-3.5 size-7 -translate-y-1/2 rounded-full bg-page" />
      <span className="min-w-0 flex-1">
        <span className="font-wide block text-[clamp(22px,6.5vw,28px)] leading-tight">{title}</span>
        <span className="mt-1 block font-mono text-[14px] opacity-90">{sub}</span>
      </span>
      {selected ? (
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-xl text-yellow">✓</span>
      ) : (
        <span className="size-12 shrink-0 rounded-full border-2 border-ash/60" />
      )}
    </button>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <main className="theme-ink flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col px-5 pt-6 pb-6 lg:max-w-[1280px] lg:px-14 lg:py-14">
        {children}
      </div>
    </main>
  );
}
