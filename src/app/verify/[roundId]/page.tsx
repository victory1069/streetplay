import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicRound } from "@/lib/data/public";
import { VerifyRound } from "@/components/public/verify-round";
import { FORMATS } from "@/lib/games/formats";
import { dateWAT, timeWAT } from "@/lib/format";

export const metadata: Metadata = { title: "Fair-play check" };

export default async function VerifyRoundPage({ params }: PageProps<"/verify/[roundId]">) {
  const { roundId } = await params;
  const round = await getPublicRound(roundId);
  if (!round) notFound();
  const format = FORMATS[round.format];
  const show = `${round.creator_handle ? `@${round.creator_handle}` : round.creator_name} · Ep ${round.episode_number}`;

  return (
    <main className="theme-paper flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-[720px] px-5 pt-10 pb-14">
        <p className="font-label text-[13px]">
          {show}
          {round.started_at ? ` · ${dateWAT(round.started_at, true)} · ${timeWAT(round.started_at)} WAT` : ""}
        </p>
        <h1 className="font-display mt-3 text-[clamp(52px,15vw,96px)]">Fair-play check</h1>
        <p className="font-wide mt-3 text-[22px]">
          {round.number ? `R${round.number} · ` : ""}
          {format?.name ?? round.format}
        </p>

        <div className="mt-6 space-y-3 text-[18px] leading-snug">
          <p>
            Before the round started, the app picked a secret random number (the <b>seed</b>) and published its fingerprint (the <b>lock</b>). A fingerprint
            can&apos;t be turned back into the seed, and no other seed gives the same one.
          </p>
          <p>
            Every random thing in the round (which slice the wheel lands on, which box holds what) comes from that seed. After the round we reveal it. If the
            seed matches the lock, nobody could have changed the result once play began. Not the host, not us.
          </p>
        </div>

        <div className="mt-8">
          <VerifyRound round={round} />
        </div>
      </div>
    </main>
  );
}
