"use client";

import { useEffect, useRef } from "react";
import { ErrorText, Spinner } from "@/components/ui";
import { useStudio } from "@/components/studio/studio-context";
import { episodeTotals } from "@/lib/data/episodes";
import { formatNaira } from "@/lib/money";
import { dateWAT, receiptLabel, timeWAT } from "@/lib/format";
import { FORMATS } from "@/lib/games/formats";
import { MARKER_NAMES, roundLine, useEpisodeLog } from "./use-episode-log";

// Printable episode log (A4). Opens the print dialog once the data is in.
export function PrintLog({ episodeId }: { episodeId: string }) {
  const studio = useStudio();
  const { log, error } = useEpisodeLog(episodeId);
  const printed = useRef(false);

  useEffect(() => {
    if (!log || !studio || printed.current) return;
    printed.current = true;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [log, studio]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!log || !studio) return <Spinner />;

  const { episode, rounds, payouts, consents, markers } = log;
  const totals = episodeTotals(log);
  const roundById = new Map(rounds.map((r) => [r.id, r]));
  const loose = payouts.filter((p) => !p.round_id);
  const th = "border-b-2 border-black py-1.5 pr-3 text-left font-mono text-[10px] uppercase tracking-wider";
  const td = "border-b border-black/30 py-1.5 pr-3 align-top";

  return (
    <main className="mx-auto w-full max-w-[210mm] flex-1 bg-white p-8 text-[12px] text-black print:p-0">
      <style>{`@page { size: A4; margin: 14mm; } @media print { body { background: #fff !important; } }`}</style>
      <div className="mb-6 flex justify-end print:hidden">
        <button type="button" onClick={() => window.print()} className="min-h-[44px] rounded-[10px] bg-black px-5 font-bold text-white">
          Print / save as PDF
        </button>
      </div>

      <header className="border-b-[3px] border-black pb-3">
        <p className="font-mono text-[10px] tracking-widest uppercase">StreetPlay · Episode log</p>
        <h1 className="mt-1 text-[24px] font-extrabold">
          Ep {episode.number} · {episode.title}
        </h1>
        <p className="mt-1">
          {studio.creator.display_name}
          {studio.creator.instagram_handle ? ` (@${studio.creator.instagram_handle})` : ""} · {dateWAT(episode.starts_at ?? episode.created_at, true)}
          {episode.location ? ` · ${episode.location}` : ""}
          {episode.sponsor_name ? ` · Prize pool by ${episode.sponsor_name}` : ""}
        </p>
      </header>

      <section className="mt-4 grid grid-cols-5 gap-3 border-b border-black/30 pb-4">
        {[
          ["Budget", formatNaira(episode.budget)],
          ["Paid", formatNaira(totals.paidTotal)],
          ["Payouts sent", String(totals.paidCount)],
          ["Rounds", String(rounds.length)],
          ["Left over", formatNaira(totals.budgetLeft)],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="font-mono text-[9px] tracking-wider uppercase">{k}</p>
            <p className="text-[16px] font-bold tabular-nums">{v}</p>
          </div>
        ))}
      </section>

      <h2 className="mt-6 mb-2 text-[14px] font-extrabold">Rounds, payouts and consents</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["Round", "Started", "Format / result", "Participant", "Consent", "Paid to", "Amount", "Receipt", "Status"].map((h) => (
              <th key={h} className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rounds.map((r) => {
            const c = consents.find((x) => x.round_id === r.id);
            const ps = payouts.filter((p) => p.round_id === r.id);
            const rowsFor = ps.length ? ps : [null];
            return rowsFor.map((p, i) => (
              <tr key={`${r.id}-${p?.id ?? i}`} className="break-inside-avoid">
                <td className={td}>{i === 0 ? `R${r.number ?? "–"}` : ""}</td>
                <td className={`${td} font-mono`}>{i === 0 ? timeWAT(r.started_at ?? r.created_at) : ""}</td>
                <td className={td}>{i === 0 ? `${FORMATS[r.format]?.name ?? r.format}${r.summary ? ` · ${r.summary}` : ""} (${r.status})` : ""}</td>
                <td className={td}>{i === 0 ? (r.participant_name ?? "") : ""}</td>
                <td className={`${td} font-mono`}>{i === 0 && c ? `${timeWAT(c.agreed_at)} v${c.release_version}` : i === 0 ? "—" : ""}</td>
                <td className={td}>{p?.account_name ?? p?.recipient_display ?? ""}</td>
                <td className={`${td} text-right font-mono`}>{p ? formatNaira(p.amount) : "₦0"}</td>
                <td className={`${td} font-mono`}>{p ? receiptLabel(p.receipt_code) : ""}</td>
                <td className={td}>{p ? `${p.status}${p.sent_at ? ` ${timeWAT(p.sent_at)}` : ""}` : ""}</td>
              </tr>
            ));
          })}
          {rounds.length === 0 && (
            <tr>
              <td className={td} colSpan={9}>
                No rounds.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {loose.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 text-[14px] font-extrabold">Viewer prizes</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Time", "Winner", "Amount", "Receipt", "Status"].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loose.map((p) => (
                <tr key={p.id}>
                  <td className={`${td} font-mono`}>{timeWAT(p.created_at)}</td>
                  <td className={td}>{p.account_name ?? p.recipient_display ?? ""}</td>
                  <td className={`${td} font-mono`}>{formatNaira(p.amount)}</td>
                  <td className={`${td} font-mono`}>{receiptLabel(p.receipt_code)}</td>
                  <td className={td}>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2 className="mt-6 mb-2 text-[14px] font-extrabold">Clip list ({markers.length})</h2>
      {markers.length === 0 ? (
        <p>No clip marks.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Time", "Mark", "Round"].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {markers.map((m) => (
              <tr key={m.id}>
                <td className={`${td} font-mono`}>{timeWAT(m.at)}</td>
                <td className={td}>{MARKER_NAMES[m.label] ?? m.label}</td>
                <td className={td}>{m.round_id ? roundLine(roundById.get(m.round_id), false) : "Between rounds"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-8 font-mono text-[9px] text-black/60">
        All times WAT. Public receipts: /e/{episode.public_code}. Consent release version as recorded on camera.
      </p>
    </main>
  );
}
