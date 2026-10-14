import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicEpisode } from "@/lib/data/public";
import { formatNaira, formatShort } from "@/lib/money";
import { dateWAT, receiptLabel, timeWAT } from "@/lib/format";
import { FORMATS } from "@/lib/games/formats";
import type { PublicEpisodePayout } from "@/types/domain";

export const metadata: Metadata = { title: "Episode receipts" };

const SHOW = 8;

function roundText(p: PublicEpisodePayout) {
  if (!p.round_format) return "Viewer prize";
  const name = FORMATS[p.round_format]?.name ?? p.round_format;
  return p.round_number ? `R${p.round_number} · ${name}` : name;
}

function Status({ s }: { s: PublicEpisodePayout["status"] }) {
  if (s === "sent") return <span className="font-mono text-[15px] font-semibold text-green-text">✓ Sent</span>;
  if (s === "sending") return <span className="font-mono text-[15px] font-semibold text-muted">··· Sending</span>;
  return <span className="font-mono text-[15px] font-semibold text-red">Reversed</span>;
}

export default async function EpisodeReceiptsPage({ params, searchParams }: PageProps<"/e/[code]">) {
  const { code } = await params;
  const data = await getPublicEpisode(code);
  if (!data) notFound();
  const { all } = await searchParams;
  const { episode: ep, payouts } = data;
  const shown = all ? payouts : payouts.slice(0, SHOW);
  const wrapped = ep.status === "wrapped";
  const day = ep.starts_at ?? payouts[0]?.created_at ?? null;
  const caption = [ep.creator_handle ? `@${ep.creator_handle}` : ep.creator_name, `Ep ${ep.number}`, ep.location, day ? dateWAT(day, true) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="theme-paper flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-[460px] px-5 pt-10 pb-12 lg:max-w-[1280px] lg:px-20 lg:pt-16">
        <p className="font-label text-[13px] lg:text-[15px]">{caption}</p>
        <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <h1 className="font-display text-[clamp(56px,17vw,72px)] lg:max-w-[760px] lg:text-[112px]">
            {formatNaira(ep.paid_total)} paid to {ep.paid_count} {ep.paid_count === 1 ? "person" : "people"}
          </h1>
          <div className="grid shrink-0 grid-cols-3 overflow-hidden rounded-[14px] border-[3px] border-ink lg:w-[400px]">
            <Stat value={`${ep.confirmed_count}/${ep.paid_count}`} label="Bank confirmed" className="bg-yellow" />
            <Stat value={String(ep.seeds_revealed)} label="Seeds verified" className="border-l-[3px] border-ink bg-card" />
            <Stat value={formatShort(ep.left_over)} label={wrapped ? `Rolled to Ep ${ep.number + 1}` : "Left over"} className="border-l-[3px] border-ink bg-card" />
          </div>
        </div>

        {payouts.length === 0 ? (
          <p className="mt-10 text-[18px] text-muted">No payouts yet. Receipts show up here the moment a winner is paid.</p>
        ) : (
          <>
            {/* Phone: stacked list */}
            <ul className="mt-8 divide-y-2 divide-ink overflow-hidden rounded-[16px] border-[3px] border-ink bg-card lg:hidden">
              {shown.map((p) => (
                <li key={p.receipt_code}>
                  <Link href={`/r/${p.receipt_code}`} className="flex items-center gap-4 px-5 py-4">
                    <span className="w-12 shrink-0 font-mono text-[14px] text-muted">{timeWAT(p.created_at)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-wide block text-[18px] leading-tight">{p.recipient_display ?? "A winner"}</span>
                      <span className="mt-1 block truncate font-mono text-[13px] text-muted">
                        {roundText(p)} · <span className="underline underline-offset-2">{receiptLabel(p.receipt_code)}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-[17px] font-semibold">{formatNaira(p.amount)}</span>
                      <Status s={p.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="mt-10 hidden overflow-hidden rounded-[16px] border-[3px] border-ink bg-card lg:block">
              <table className="w-full border-collapse text-left">
                <thead className="bg-ink">
                  <tr className="font-mono text-[14px] tracking-[0.12em] text-yellow uppercase">
                    <th className="px-7 py-4 font-normal">Time</th>
                    <th className="px-4 py-4 font-normal">Winner</th>
                    <th className="px-4 py-4 font-normal">Round</th>
                    <th className="px-4 py-4 text-right font-normal">Amount</th>
                    <th className="px-4 py-4 font-normal">Receipt</th>
                    <th className="px-7 py-4 text-right font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.receipt_code} className="border-t-2 border-ink">
                      <td className="px-7 py-4 font-mono text-[15px] text-muted">{timeWAT(p.created_at)}</td>
                      <td className="font-wide px-4 py-4 text-[19px]">{p.recipient_display ?? "A winner"}</td>
                      <td className="px-4 py-4 text-[19px]">{roundText(p)}</td>
                      <td className="px-4 py-4 text-right font-mono text-[19px] font-semibold">{formatNaira(p.amount)}</td>
                      <td className="px-4 py-4">
                        <Link href={`/r/${p.receipt_code}`} className="font-mono text-[16px] underline underline-offset-4">
                          {receiptLabel(p.receipt_code)}
                        </Link>
                      </td>
                      <td className="px-7 py-4 text-right">
                        <Status s={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-6 font-mono text-[14px] leading-relaxed text-muted lg:text-[15px]">
              {payouts.length > SHOW && !all ? (
                <>
                  Showing {SHOW} of {payouts.length} ·{" "}
                  <Link href={`/e/${code}?all=1`} className="text-ink underline underline-offset-4">
                    Show all
                  </Link>{" "}
                  ·{" "}
                </>
              ) : (
                <>Showing all {payouts.length} · </>
              )}
              Winners are listed by first name and initial only
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  return (
    <div className={`px-4 py-4 ${className}`}>
      <p className="font-display tabular text-[clamp(32px,10vw,48px)]">{value}</p>
      <p className="mt-1 font-mono text-[11px] leading-tight uppercase lg:text-[12px]">{label}</p>
    </div>
  );
}
