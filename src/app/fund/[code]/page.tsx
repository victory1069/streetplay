import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFundingTarget } from "@/lib/data/public";
import { FundForm } from "@/components/public/fund-form";
import { Logo } from "@/components/ui";
import { dateWAT } from "@/lib/format";

export const metadata: Metadata = { title: "Fund the prizes" };

export default async function FundPage({ params }: PageProps<"/fund/[code]">) {
  const { code } = await params;
  const ep = await getFundingTarget(code);
  if (!ep) notFound();
  const who = ep.creator.instagram_handle ? `@${ep.creator.instagram_handle}` : ep.creator.display_name;

  return (
    <main className="theme-yellow flex flex-1 flex-col">
      <div className="mx-auto grid w-full max-w-[460px] flex-1 content-start gap-8 px-5 pt-8 pb-10 lg:max-w-[1100px] lg:grid-cols-2 lg:gap-16 lg:pt-16">
        <div>
          <Logo />
          <p className="font-label mt-8 text-[13px]">
            {who}
            {ep.starts_at ? ` · ${dateWAT(ep.starts_at, true)}` : ""}
          </p>
          <h1 className="font-display mt-3 text-[clamp(52px,15vw,96px)]">
            Fund the prizes for Ep {ep.number}
            {ep.location ? ` · ${ep.location}` : ""}
          </h1>
          <p className="mt-4 text-[18px] leading-snug">
            {ep.title}. Strangers on the street win your money on camera, paid straight to their bank, with a public receipt for every naira.
          </p>
        </div>
        <div className="rounded-[18px] border-[3px] border-ink bg-paper p-6">
          {ep.status === "wrapped" ? (
            <p className="text-[18px] leading-snug">This episode has already wrapped. Ask {who} for the link to the next one.</p>
          ) : (
            <FundForm code={code.toUpperCase()} />
          )}
        </div>
      </div>
    </main>
  );
}
