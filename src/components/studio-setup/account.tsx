"use client";

import { useState, type ReactNode } from "react";
import { Avatar, Button, Caption, ErrorText, Headline, Input, PhoneColumn, Spinner } from "@/components/ui";
import { StudioNav } from "@/components/ui/studio-nav";
import { useStudioState } from "@/components/studio/studio-context";
import { signOut } from "@/lib/data/auth";
import { updatePayoutLimits } from "@/lib/data/studio";
import { appHost, formatPhone } from "@/lib/format";
import { formatNaira, parseNairaInput, toNaira } from "@/lib/money";
import { errorMessage } from "./shared";

/** Account tab: your show, payout limits, plan, sign out. */
export function Account() {
  const { ctx, refresh } = useStudioState();
  const [signingOut, setSigningOut] = useState(false);

  if (!ctx)
    return (
      <main className="theme-paper flex flex-1 flex-col">
        <Spinner />
        <StudioNav />
      </main>
    );

  const c = ctx.creator;
  const name = ctx.profile?.display_name || c.display_name;

  return (
    <main className="theme-paper flex flex-1 flex-col">
      <PhoneColumn>
        <div className="flex flex-1 flex-col px-7 pt-8 pb-6">
          <Headline className="text-[clamp(52px,16vw,72px)]">Account</Headline>

          <div className="mt-6 flex items-center gap-4 rounded-[14px] border-[3px] border-ink bg-card px-5 py-4">
            <Avatar name={name} size={56} />
            <div className="min-w-0 flex-1">
              <p className="font-wide truncate text-[20px] leading-tight">{c.display_name}</p>
              <p className="mt-1 truncate font-mono text-[14px] opacity-70">
                {c.instagram_handle ? `@${c.instagram_handle}` : ""}
                {ctx.phone ? ` · ${formatPhone(ctx.phone)}` : ""}
              </p>
            </div>
          </div>

          {c.instagram_handle && (
            <div className="mt-3 rounded-[14px] bg-sand px-5 py-3 font-mono text-[14px]">
              Viewers play at <span className="font-semibold break-words">{appHost()}/play/{c.instagram_handle}</span>
            </div>
          )}

          <Limits creatorId={c.id} perDay={c.limit_per_day} confirmAbove={c.confirm_above} repeat={c.allow_repeat_winners} onSaved={refresh} />

          <div className="mt-6 flex items-center justify-between rounded-[14px] border-[3px] border-ink bg-card px-6 py-4">
            <span className="font-label">Plan</span>
            <span className="font-wide text-[19px]">{c.plan === "pro" ? "Pro" : "Free"}</span>
          </div>

          <div className="mt-auto pt-8">
            <Button
              variant="outline"
              size="md"
              font="bold"
              loading={signingOut}
              onClick={async () => {
                setSigningOut(true);
                await signOut();
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
        <StudioNav />
      </PhoneColumn>
    </main>
  );
}

function Limits({
  creatorId,
  perDay,
  confirmAbove,
  repeat,
  onSaved,
}: {
  creatorId: string;
  perDay: number;
  confirmAbove: number;
  repeat: boolean;
  onSaved: () => Promise<void>;
}) {
  const [day, setDay] = useState(String(toNaira(perDay)));
  const [above, setAbove] = useState(String(toNaira(confirmAbove)));
  const [allow, setAllow] = useState(repeat);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-6 rounded-[18px] bg-ink px-6 py-5 text-paper"
      onSubmit={async (e) => {
        e.preventDefault();
        const d = parseNairaInput(day);
        const a = parseNairaInput(above);
        if (d === null || a === null) return setError("Enter amounts like 500,000 or 500k.");
        setBusy(true);
        setError(null);
        try {
          await updatePayoutLimits(creatorId, { limit_per_day: d, confirm_above: a, allow_repeat_winners: allow });
          await onSaved();
          setSaved(true);
          window.setTimeout(() => setSaved(false), 1500);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Caption className="mb-3 text-yellow">Default payout limits</Caption>
      <LimitField label="Max a day">
        <Input tone="dark" mono inputMode="decimal" value={day} onChange={(e) => setDay(e.target.value)} className="!h-[48px] w-40 !px-3 text-right !text-[18px]" aria-label="Max a day in naira" />
      </LimitField>
      <LimitField label="Hold to send above">
        <Input tone="dark" mono inputMode="decimal" value={above} onChange={(e) => setAbove(e.target.value)} className="!h-[48px] w-40 !px-3 text-right !text-[18px]" aria-label="Hold to send above, in naira" />
      </LimitField>
      <LimitField label="Repeat winners">
        <button type="button" onClick={() => setAllow((v) => !v)} className="min-h-[44px] font-mono text-[18px]" aria-pressed={allow}>
          {allow ? "Allow" : "Block"}
        </button>
      </LimitField>
      <p className="mt-2 font-mono text-[13px] opacity-70">
        Now: {formatNaira(perDay)} a day · hold to send above {formatNaira(confirmAbove)}
      </p>
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
      <Button type="submit" variant="yellow" size="md" font="bold" className="mt-3" loading={busy}>
        {saved ? "Saved ✓" : "Save limits"}
      </Button>
    </form>
  );
}

function LimitField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[18px]">{label}</span>
      {children}
    </div>
  );
}
