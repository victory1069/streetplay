"use client";

import { useState, type ReactNode } from "react";
import { Button, Caption, ErrorText, PhoneColumn, Spinner, TopBar } from "@/components/ui";
import { downloadFile, share, useCopy } from "@/components/ui/interactive";
import { clipMarkersCsv, episodeLogCsv, episodeTotals } from "@/lib/data/episodes";
import { appHost, appUrl } from "@/lib/format";
import { useEpisodeLog } from "./use-episode-log";

export function ExportScreen({ episodeId }: { episodeId: string }) {
  const { log, error } = useEpisodeLog(episodeId);
  const [clips, setClips] = useState(true);
  const [epLog, setEpLog] = useState(true);
  const [copied, copy] = useCopy();
  const [note, setNote] = useState<string | null>(null);

  if (error)
    return (
      <main className="theme-paper flex flex-1 flex-col">
        <PhoneColumn className="p-6">
          <ErrorText>{error}</ErrorText>
        </PhoneColumn>
      </main>
    );
  if (!log) return <Spinner />;

  const { episode } = log;
  const totals = episodeTotals(log);
  const link = `${appHost()}/e/${episode.public_code}`;
  const fullLink = appUrl(`/e/${episode.public_code}`);
  const message = `Ep ${episode.number} · ${episode.title}: ${totals.paidCount} receipts. Verify: ${fullLink}`;

  const buildFiles = () => {
    const out: { name: string; content: string }[] = [];
    if (clips) out.push({ name: `ep${episode.number}-clip-list.csv`, content: clipMarkersCsv(log) });
    if (epLog) out.push({ name: `ep${episode.number}-episode-log.csv`, content: episodeLogCsv(log) });
    return out;
  };

  const send = async (to: "whatsapp" | "email") => {
    setNote(null);
    const files = buildFiles();
    const asFiles = files.map((f) => new File([f.content], f.name, { type: "text/csv" }));
    if (asFiles.length && typeof navigator.share === "function" && navigator.canShare?.({ files: asFiles })) {
      await share({ title: `Ep ${episode.number} export`, text: message, files: asFiles });
      return;
    }
    // No file sharing here: download the files, then open the app with the link.
    for (const f of files) downloadFile(f.name, f.content);
    if (to === "whatsapp") window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    else window.location.assign(`mailto:?subject=${encodeURIComponent(`Ep ${episode.number} · ${episode.title}`)}&body=${encodeURIComponent(message)}`);
    if (files.length) setNote(`${files.length === 1 ? "File" : "Files"} downloaded. Attach ${files.length === 1 ? "it" : "them"} to your message.`);
  };

  return (
    <main className="theme-paper flex flex-1 flex-col">
      <PhoneColumn>
        <TopBar title={`Export Ep ${episode.number}`} back={`/studio/episodes/${episodeId}/log`} />
        <div className="flex flex-1 flex-col px-5 pt-5 pb-6">
          <div className="space-y-3">
            <ExportCard checked={clips} onChange={setClips} title="Clip list for the editor" sub={`${log.markers.length} marks · timestamps · CSV`} />
            <ExportCard
              checked={epLog}
              onChange={setEpLog}
              title="Episode log"
              sub="Payouts + consents · PDF"
              extra={
                <a
                  href={`/studio/episodes/${episodeId}/log/print`}
                  target="_blank"
                  rel="noopener"
                  className="mt-2 inline-flex min-h-[44px] items-center font-mono text-[14px] underline underline-offset-4"
                >
                  Open PDF ↗
                </a>
              }
            />
            <ExportCard checked={false} disabled title="Sponsor report" sub="Reach, votes, paid, branded moments" extra={<span className="font-label mt-2 block text-muted">Coming soon</span>} />
          </div>

          <div className="mt-4 rounded-[14px] border-[3px] border-dashed border-ink px-5 py-4">
            <Caption>Caption verify link</Caption>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="truncate font-mono text-[20px] font-semibold">{link}</span>
              <button type="button" onClick={() => copy(fullLink)} className="font-wide min-h-[44px] shrink-0 rounded-[10px] bg-ink px-4 text-[16px] text-yellow">
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-[16px] text-muted">Lists all {totals.paidCount} receipts. Paste it under the post.</p>
          </div>

          <div className="mt-auto pt-10">
            <Caption className="mb-3">Send to</Caption>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="ink" size="lg" onClick={() => void send("whatsapp")}>
                WhatsApp
              </Button>
              <Button variant="outline" size="lg" onClick={() => void send("email")}>
                Email
              </Button>
            </div>
            {note && (
              <p className="mt-3 text-[15px] text-muted" aria-live="polite">
                {note}
              </p>
            )}
          </div>
        </div>
      </PhoneColumn>
    </main>
  );
}

function ExportCard({
  checked,
  onChange,
  title,
  sub,
  disabled,
  extra,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  title: string;
  sub: string;
  disabled?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className={`rounded-[14px] px-5 py-4 ${checked ? "bg-ink text-paper" : "border-[3px] border-ink bg-card"} ${disabled ? "opacity-60" : ""}`}>
      <label className={`flex items-center gap-4 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
        <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
        <span
          aria-hidden
          className={`grid size-12 shrink-0 place-items-center rounded-[8px] text-[24px] ${checked ? "bg-yellow text-ink" : "border-2 border-ink bg-card"}`}
        >
          {checked ? "✓" : ""}
        </span>
        <span className="min-w-0">
          <span className="font-wide block text-[20px] leading-tight">{title}</span>
          <span className={`mt-1 block font-mono text-[14px] ${checked ? "text-ash" : "text-muted"}`}>{sub}</span>
        </span>
      </label>
      {extra && <div className="pl-16">{extra}</div>}
    </div>
  );
}
