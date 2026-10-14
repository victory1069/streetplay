import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicEpisode, getPublicReceipt } from "@/lib/data/public";
import { ReceiptView } from "@/components/public/receipt-view";
import { bankNameFor, supportHref } from "@/components/public/public-helpers";
import { receiptLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: PageProps<"/r/[receiptCode]">) {
  const { receiptCode } = await params;
  const receipt = await getPublicReceipt(receiptCode);
  if (!receipt) notFound();

  const [bank, ep] = await Promise.all([
    bankNameFor(receipt.bank_code),
    getPublicEpisode(receipt.episode_code).catch(() => null),
  ]);

  return (
    <ReceiptView
      receipt={receipt}
      bank={bank}
      support={supportHref(`Receipt ${receiptLabel(receipt.receipt_code)}`)}
      episodeReceipts={ep?.episode.paid_count ?? null}
    />
  );
}
