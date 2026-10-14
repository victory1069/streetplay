import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFundingTarget } from "@/lib/data/public";
import { Shout } from "@/components/ui";

export const metadata: Metadata = { title: "Thank you" };

export default async function FundDonePage({ params }: PageProps<"/fund/[code]/done">) {
  const { code } = await params;
  const ep = await getFundingTarget(code);
  if (!ep) notFound();
  const who = ep.creator.instagram_handle ? `@${ep.creator.instagram_handle}` : ep.creator.display_name;

  return (
    <main className="theme-yellow flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-[640px] px-5 pt-12 pb-12">
        <Shout>Thank you!</Shout>
        <h1 className="font-display mt-4 text-[clamp(44px,13vw,72px)]">
          Your money is in the prize pool for Ep {ep.number}.
        </h1>
        <p className="mt-5 text-[18px] leading-snug">
          It went into {who}&apos;s StreetPlay wallet, tagged to {ep.title}. You&apos;ll get an email receipt from our payments partner. If the payment is still
          processing, it lands within a few minutes.
        </p>
        <div className="mt-8 rounded-[18px] border-[3px] border-ink bg-paper p-6">
          <p className="font-label">What you&apos;ll see</p>
          <ul className="mt-3 space-y-3 text-[17px] leading-snug">
            <li>✓ Every payout from this episode gets a public receipt, with “Prize pool by {ep.sponsor_name ?? "your brand"}” on it.</li>
            <li>✓ Branded wheel slices carry your name on screen when the host runs Spin the Wheel.</li>
            <li>✓ After the episode, one page lists every winner, amount and bank confirmation.</li>
          </ul>
        </div>
        <Link href={`/e/${code.toUpperCase()}`} className="mt-6 inline-flex min-h-[44px] items-center font-mono text-[15px] underline underline-offset-4">
          Episode receipts →
        </Link>
      </div>
    </main>
  );
}
