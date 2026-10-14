"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Arrow, Button, ErrorText, Field, Headline, Input, PhoneColumn, Spinner } from "@/components/ui";
import { useStudioState } from "@/components/studio/studio-context";
import { createCreatorProfile } from "@/lib/data/studio";
import { appHost } from "@/lib/format";
import { STEP_PATH, nextOnboardingStep } from "@/lib/onboarding";
import { signOut } from "@/lib/data/auth";
import { OnboardingHeader } from "./onboarding";
import { errorMessage } from "./shared";

/** First screen after a new number signs in: Step 1 of 3, Your show. */
export function Welcome() {
  const router = useRouter();
  const { ctx, loading, refresh } = useStudioState();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creating = useRef(false);

  // Already set up: carry on from wherever they left off.
  useEffect(() => {
    if (ctx && !creating.current) router.replace(STEP_PATH[nextOnboardingStep(ctx)]);
  }, [ctx, router]);

  if (loading || ctx)
    return (
      <main className="theme-paper flex flex-1 flex-col">
        <Spinner />
      </main>
    );

  const cleanHandle = handle.replace(/^@/, "");
  const handleOk = /^[A-Za-z0-9._]{2,30}$/.test(cleanHandle);

  return (
    <main className="theme-paper flex flex-1 flex-col">
      <PhoneColumn>
        <OnboardingHeader step={1} title="Your show" />
        <form
          className="flex flex-1 flex-col gap-6 px-7 pt-7 pb-[calc(env(safe-area-inset-bottom)+24px)]"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return setError("Add the name your viewers know you by.");
            if (!handleOk) return setError("Handles use letters, numbers, dots and underscores.");
            setBusy(true);
            setError(null);
            creating.current = true;
            try {
              await createCreatorProfile({ displayName: name, handle: cleanHandle });
              await refresh();
              router.replace(STEP_PATH.wallet);
            } catch (err) {
              creating.current = false;
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          <Headline className="text-[clamp(48px,14vw,64px)] leading-[0.86]">Set up your show.</Headline>
          <Field label="Show name" hint="It's on every receipt your winners get.">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tobi Streets" autoComplete="nickname" />
          </Field>
          <Field label="Instagram handle">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-[22px] font-bold text-muted">@</span>
              <Input
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace(/^@/, "").replace(/\s/g, "").toLowerCase())}
                placeholder="tobi.streets"
                autoCapitalize="none"
                autoCorrect="off"
                className="pl-11"
              />
            </div>
            <span className="mt-2 block rounded-[10px] bg-sand px-4 py-3 font-mono text-[14px] leading-snug">
              Viewers play at{" "}
              <span className="font-semibold break-words">
                {appHost()}/play/{cleanHandle || "your.handle"}
              </span>
            </span>
          </Field>
          <ErrorText>{error}</ErrorText>
          <div className="mt-auto pt-4">
            <Button type="submit" loading={busy} disabled={!name.trim() || !handleOk}>
              NEXT: WALLET <Arrow />
            </Button>
            <button type="button" onClick={() => void signOut()} className="mt-4 min-h-[44px] w-full text-center text-[16px] font-semibold underline underline-offset-4">
              Not you? Use another number
            </button>
          </div>
        </form>
      </PhoneColumn>
    </main>
  );
}
