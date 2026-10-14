import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicReceipt } from "@/lib/data/public";
import { DeleteFlow } from "@/components/public/delete-flow";
import { formatNaira } from "@/lib/money";
import { dateWAT, receiptLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Delete my details", robots: { index: false } };

export default async function DeleteMyDetailsPage({ params }: PageProps<"/r/[receiptCode]/delete">) {
  const { receiptCode } = await params;
  const receipt = await getPublicReceipt(receiptCode);
  if (!receipt) notFound();
  const from = receipt.creator_handle ? `@${receipt.creator_handle}` : receipt.creator_name;

  return (
    <main className="theme-paper flex flex-1 flex-col">
      <div className="mx-auto grid w-full max-w-[460px] flex-1 grid-cols-1 content-start gap-6 px-5 pt-10 pb-6 lg:max-w-[1280px] lg:grid-cols-2 lg:gap-x-20 lg:px-20 lg:pt-20">
        <div className="space-y-4">
          <h1 className="font-display text-[clamp(56px,17vw,72px)] lg:text-[112px]">Delete my details</h1>
          <p className="text-[18px] leading-snug lg:text-[22px]">
            For receipt <b className="font-mono">{receiptLabel(receipt.receipt_code)}</b> ({formatNaira(receipt.amount)} on {dateWAT(receipt.sent_at ?? receipt.created_at)} from {from}).
          </p>
        </div>

        <section className="overflow-hidden rounded-[16px] border-[3px] border-ink bg-card lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-start">
          <p className="font-label bg-ink px-6 py-4 text-[14px] text-yellow">We delete</p>
          <ul className="space-y-3 px-6 py-5 text-[19px] font-bold lg:text-[22px]">
            {["Your full name and phone number", "Your account number and bank", "Your name on the public receipt"].map((t) => (
              <li key={t} className="flex gap-2">
                <span aria-hidden className="font-normal">
                  ✕
                </span>
                {t}
              </li>
            ))}
          </ul>
          <p className="font-label border-t-2 border-ink/20 bg-sand px-6 py-4 text-[14px]">The law makes us keep</p>
          <p className="px-6 py-5 text-[19px] leading-snug lg:text-[21px]">
            The amount, date and receipt code, with no name attached. The public receipt will say &quot;Paid to a winner&quot;.
          </p>
        </section>

        <p className="text-[18px] leading-snug text-muted">
          This doesn&apos;t remove the video from Instagram. To do that, ask {from} directly. We&apos;ll pass your request on to them as well.
        </p>

        <div className="pt-6 lg:max-w-[440px] lg:pt-16">
          <DeleteFlow receiptCode={receipt.receipt_code} alreadyDeleted={receipt.anonymized} />
        </div>
      </div>
    </main>
  );
}
