"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdmitTicket, Headline, PhoneColumn } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { CodeScreen, PhoneForm, routeAfterSignIn } from "./phone-sign-in";

/** Landing (design 1): pitch + phone number, then the code on its own screen. */
export function Landing() {
  const router = useRouter();
  const nextParam = useSearchParams().get("next");
  const next = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    createClient()
      .auth.getClaims()
      .then(({ data }) => {
        if (alive && data?.claims?.sub) void routeAfterSignIn(router.replace, next);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [next, router]);

  if (phone) return <CodeScreen phone={phone} onBack={() => setPhone(null)} onVerified={() => routeAfterSignIn(router.replace, next)} />;

  return (
    <main className="theme-yellow flex flex-1 flex-col overflow-x-hidden">
      <PhoneColumn className="px-7 pt-10 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <AdmitTicket />
        <Headline className="mt-7 text-[clamp(56px,17vw,82px)] leading-[0.86]">Run the game. Pay on camera.</Headline>
        <p className="mt-5 text-[19px] leading-[1.45]">
          Question packs, prize wheels and bank payouts with the winner&apos;s verified name on screen. Viewers can play along too.
        </p>
        <div className="mt-auto pt-10">
          <PhoneForm onSent={setPhone} />
        </div>
      </PhoneColumn>
    </main>
  );
}
