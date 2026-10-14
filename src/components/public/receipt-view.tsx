import Link from "next/link";
import type { ReactNode } from "react";
import { Amount, ButtonLink, CheckDot, KeyValue, Logo, PhoneColumn, Shout, Ticket } from "@/components/ui";
import { formatNaira } from "@/lib/money";
import { appHost, appUrl, dateWAT, maskPhone, receiptLabel, timeWAT } from "@/lib/format";
import { FORMATS } from "@/lib/games/formats";
import type { PublicReceipt } from "@/types/domain";
import { AutoRefresh, SaveReceiptButton, ShareReceiptButton } from "./receipt-client";
import { shortHex, timeWATSeconds } from "./display";

export interface ReceiptViewProps {
  receipt: PublicReceipt;
  bank: string;
  support: string;
  episodeReceipts: number | null;
}

const linkCls = "inline-flex min-h-[44px] items-center font-mono text-[15px] underline underline-offset-4";

function parts(r: PublicReceipt, bank: string) {
  const name = r.anonymized || !r.recipient_display ? null : r.recipient_display;
  const via = r.channel === "airtime" ? "Airtime" : bank;
  const from = r.creator_handle ? `@${r.creator_handle}` : r.creator_name;
  const format = r.round_format ? FORMATS[r.round_format]?.name ?? r.round_format : null;
  const round = r.round_number ? `R${r.round_number} · ${format ?? ""}` : format ?? "Viewer prize";
  return { name, via, from, format, round, code: receiptLabel(r.receipt_code) };
}

export function ReceiptView(props: ReceiptViewProps) {
  const { receipt } = props;
  if (receipt.status === "sending") return <Pending {...props} />;
  if (receipt.status === "reversed") return <Reversed {...props} />;
  return (
    <>
      {receipt.kind === "viewer" ? <ViewerSent {...props} /> : <ParticipantSent {...props} />}
      <Desktop {...props} />
    </>
  );
}

function ParticipantSent({ receipt, bank, support }: ReceiptViewProps) {
  const p = parts(receipt, bank);
  const when = `${dateWAT(receipt.sent_at ?? receipt.created_at)} · ${timeWAT(receipt.sent_at ?? receipt.created_at)} WAT`;
  const line = `${p.name ?? "Paid to a winner"} · ${p.via}${receipt.account_last2 && receipt.channel === "bank" ? ` ••${receipt.account_last2}` : ""}`;
  return (
    <main className="theme-yellow flex flex-1 flex-col lg:hidden">
      <PhoneColumn className="px-5 pt-10 pb-5">
        <Shout className="text-[clamp(52px,17vw,72px)]">E don land!</Shout>
        <Ticket
          tone="card"
          outline
          className="mt-6"
          bodyClassName="px-6 pt-5 pb-6"
          stub={
            <div className="space-y-2">
              <KeyValue k="Receipt" v={p.code} />
              <KeyValue k="When" v={<span className="font-normal">{when}</span>} />
              <KeyValue k="From" v={<span className="font-normal">{p.from}</span>} />
            </div>
          }
        >
          <p className="flex items-center gap-3 font-mono text-[16px] font-semibold tracking-[0.12em] text-green-text">
            <CheckDot size="sm" /> {receipt.channel === "airtime" ? "SENT AS AIRTIME" : "SENT TO YOUR BANK"}
          </p>
          <Amount className="mt-2 text-[clamp(64px,22vw,92px)]">{formatNaira(receipt.amount)}</Amount>
          <p className="font-wide mt-3 text-[18px]">{line}</p>
        </Ticket>
        <p className="mt-5 text-[18px] leading-snug">
          {receipt.channel === "airtime" ? "Check your airtime balance." : "Check your bank app. It can take up to 2 minutes to show."}
        </p>
        <div className="mt-auto pt-10">
          <SaveReceiptButton
            data={{
              status: receipt.channel === "airtime" ? "SENT AS AIRTIME" : "SENT TO YOUR BANK",
              amount: formatNaira(receipt.amount),
              line,
              rows: [
                ["Receipt", p.code],
                ["When", when],
                ["From", p.from],
              ],
              code: receipt.receipt_code,
            }}
          />
          <div className="mt-3 flex justify-between gap-4">
            <a href={support} className={linkCls}>
              Something wrong?
            </a>
            {!receipt.anonymized && (
              <Link href={`/r/${receipt.receipt_code}/delete`} className={linkCls}>
                Delete my data
              </Link>
            )}
          </div>
        </div>
      </PhoneColumn>
    </main>
  );
}

function ViewerSent({ receipt, bank }: ReceiptViewProps) {
  const p = parts(receipt, bank);
  return (
    <main className="theme-yellow flex flex-1 flex-col lg:hidden">
      <PhoneColumn className="px-5 pt-10 pb-5">
        <Shout className="text-[clamp(40px,12.5vw,60px)]">E don land!</Shout>
        <Ticket
          tone="card"
          outline
          className="mt-6"
          bodyClassName="px-6 pt-5 pb-8"
          stub={
            <div className="space-y-2">
              <KeyValue k="Receipt" v={p.code} />
              <KeyValue k="When" v={<span className="font-normal">{timeWAT(receipt.sent_at ?? receipt.created_at)} WAT</span>} />
              <KeyValue k="From" v={<span className="font-normal">{`${p.from} · Ep ${receipt.episode_number}`}</span>} />
            </div>
          }
        >
          <p className="flex items-center gap-3 font-mono text-[16px] font-semibold tracking-[0.12em] text-green-text">
            <CheckDot size="sm" /> SENT
          </p>
          <Amount className="mt-2 text-[clamp(64px,22vw,92px)]">{formatNaira(receipt.amount)}</Amount>
          <p className="font-wide mt-3 text-[18px]">{p.name ? `to ${p.name} · ${p.via}` : `Paid to a winner · ${p.via}`}</p>
        </Ticket>
        <div className="mt-auto space-y-4 pt-10">
          <ShareReceiptButton text={`${formatNaira(receipt.amount)} landed from ${p.from}'s Live. No be cap.`} url={appUrl(`/r/${receipt.receipt_code}`)} />
          {receipt.creator_handle && (
            <ButtonLink href={`/play/${receipt.creator_handle}`} variant="outline" size="md" font="bold">
              Back to the game
            </ButtonLink>
          )}
          <div className="flex justify-between gap-4">
            <Link href={`/r/${receipt.receipt_code}`} className={linkCls}>
              {appHost()}/r/{receipt.receipt_code.slice(0, 4)}
            </Link>
            {!receipt.anonymized && (
              <Link href={`/r/${receipt.receipt_code}/delete`} className={linkCls}>
                Delete my data
              </Link>
            )}
          </div>
        </div>
      </PhoneColumn>
    </main>
  );
}

function Step({ tone, title, sub, highlight }: { tone: "green" | "pending" | "empty"; title: string; sub?: string; highlight?: boolean }) {
  return (
    <li className={`flex items-center gap-4 px-6 py-4 ${highlight ? "bg-yellow" : ""}`}>
      <CheckDot tone={tone} />
      <span className="min-w-0">
        <span className={`font-wide block text-[20px] leading-tight ${tone === "empty" ? "text-muted" : ""}`}>{title}</span>
        {sub && <span className="mt-1 block font-mono text-[14px]">{sub}</span>}
      </span>
    </li>
  );
}

function Pending({ receipt, bank, support }: ReceiptViewProps) {
  const p = parts(receipt, bank);
  const first = p.name?.split(/\s+/)[0];
  const waiting = { title: "Waiting for the host's network", sub: "Sends automatically" };
  return (
    <main className="theme-paper flex flex-1 flex-col">
      <AutoRefresh />
      <PhoneColumn className="px-5 pt-10 pb-5">
        <p className="font-wide text-[22px]">{first ? `${first}, your` : "Your"}</p>
        <Amount className="text-[clamp(72px,24vw,110px)]">{formatNaira(receipt.amount)}</Amount>
        <p className="font-display text-[clamp(40px,13vw,56px)]">is locked in.</p>

        <ol className="mt-6 divide-y-2 divide-dashed divide-ink overflow-hidden rounded-[16px] border-[3px] border-ink bg-card" aria-live="polite">
          <Step tone="green" title="You won" sub={`${timeWAT(receipt.created_at)} · ${p.format ?? "Viewer prize"}`} />
          <Step tone="green" title="Name checked" sub={`${(p.name ?? "Winner").toUpperCase()} · ${p.via}`} />
          <Step tone="pending" title={waiting.title} sub={waiting.sub} highlight />
          <Step tone="empty" title="In your account" />
        </ol>

        <p className="mt-5 text-[18px] leading-snug">
          You don&apos;t need to do anything.
          {receipt.phone_last4 ? (
            <>
              {" "}
              We&apos;ll text <b>{maskPhone(receipt.phone_last4)}</b> the moment it&apos;s sent.
            </>
          ) : (
            " This page updates by itself the moment it's sent."
          )}
        </p>
        <div className="mt-auto pt-10 text-center">
          <a href={support} className={linkCls}>
            Contact StreetPlay support
          </a>
        </div>
      </PhoneColumn>
    </main>
  );
}

function Reversed({ receipt, support }: ReceiptViewProps) {
  return (
    <main className="theme-paper flex flex-1 flex-col">
      <PhoneColumn className="px-5 pt-10 pb-5">
        <p className="font-label">Receipt {receiptLabel(receipt.receipt_code)}</p>
        <Amount className="mt-2 text-[clamp(64px,22vw,96px)]">{formatNaira(receipt.amount)}</Amount>
        <h1 className="font-display mt-2 text-[clamp(40px,13vw,56px)]">This transfer came back.</h1>
        <p className="mt-4 text-[18px] leading-snug">
          The bank returned this payment, so it isn&apos;t in the account. {receipt.creator_handle ? `@${receipt.creator_handle}` : receipt.creator_name} has been told. If you&apos;re
          the winner, contact support and we&apos;ll sort it out.
        </p>
        <div className="mt-auto pt-10 text-center">
          <a href={support} className={linkCls}>
            Contact StreetPlay support
          </a>
        </div>
      </PhoneColumn>
    </main>
  );
}

function CheckRow({ title, sub, pending }: { title: string; sub: ReactNode; pending?: boolean }) {
  return (
    <li className="flex items-center gap-5 px-6 py-5">
      <CheckDot tone={pending ? "pending" : "green"} />
      <span>
        <span className="font-wide block text-[22px] leading-tight">{title}</span>
        <span className="mt-1 block font-mono text-[14px] text-muted">{sub}</span>
      </span>
    </li>
  );
}

function Desktop({ receipt, bank, episodeReceipts }: ReceiptViewProps) {
  const p = parts(receipt, bank);
  const at = receipt.sent_at ?? receipt.created_at;
  const chance = receipt.round_format ? FORMATS[receipt.round_format]?.usesRandomness : false;
  return (
    <main className="theme-paper hidden flex-1 lg:flex">
      <div className="mx-auto grid w-full max-w-[1280px] grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] gap-14 px-20 pt-20 pb-16">
        <div>
          <Ticket
            tone="card"
            outline
            className="shadow-[12px_12px_0_var(--ink)]"
            bodyClassName="p-0"
            stubClassName="px-8 pt-5 pb-7"
            stub={
              <div className="space-y-3">
                <KeyValue k="When" v={<span className="font-normal">{`${dateWAT(at, true)} · ${timeWAT(at)} WAT`}</span>} />
                <KeyValue k="Show" v={<span className="font-normal">{`${p.from} · Ep ${receipt.episode_number}`}</span>} />
                <KeyValue k="Round" v={<span className="font-normal">{p.round}</span>} />
                {receipt.sponsor_name && (
                  <KeyValue k="Prize pool by" v={<span className="font-wide inline-block border-2 border-ink px-4 py-0.5 text-[15px] uppercase">{receipt.sponsor_name}</span>} />
                )}
              </div>
            }
          >
            <div className="flex items-center justify-between rounded-t-[15px] bg-ink px-6 py-5" style={{ ["--page" as string]: "var(--ink)" }}>
              <Logo inverted />
              <span className="font-mono text-[16px] text-yellow">{p.code}</span>
            </div>
            <div className="px-8 pt-7 pb-6">
              <p className="flex items-center gap-3 font-mono text-[16px] font-semibold tracking-[0.14em] text-green-text">
                <CheckDot size="sm" /> PAYOUT VERIFIED
              </p>
              <Amount className="mt-3 text-[112px]">{formatNaira(receipt.amount)}</Amount>
              <p className="font-wide mt-3 text-[22px]">{p.name ? `Paid to ${p.name}` : "Paid to a winner"}</p>
            </div>
          </Ticket>
        </div>

        <div>
          <p className="font-shout text-[52px]" style={{ textShadow: "0.06em 0.06em 0 var(--yellow)" }}>
            No be cap.
          </p>
          <h1 className="font-display mt-6 text-[clamp(56px,6vw,80px)]">This money was really sent, and the game was fair.</h1>
          <ul className="mt-8 divide-y-2 divide-dashed divide-ink rounded-[16px] border-[3px] border-ink bg-card">
            {receipt.provider_confirmed ? (
              <CheckRow title="Bank confirmed the transfer" sub={`Reference from the payments partner · ${timeWATSeconds(receipt.sent_at)}`} />
            ) : (
              <CheckRow pending title="Waiting for the bank's reference" sub="The payments partner hasn't confirmed yet" />
            )}
            {chance && receipt.commitment && (
              <CheckRow title="Result was locked before the round" sub={`Seed sealed ${timeWAT(receipt.seed_sealed_at)} · ${shortHex(receipt.commitment)}`} />
            )}
            {receipt.consent_at && <CheckRow title="Winner agreed on camera" sub={`Consent timestamped ${timeWAT(receipt.consent_at)}`} />}
          </ul>
          <div className="mt-8 flex flex-wrap gap-x-12 gap-y-2">
            <Link href={`/e/${receipt.episode_code}`} className={linkCls}>
              All {episodeReceipts ? `${episodeReceipts} ` : ""}receipts from Ep {receipt.episode_number} →
            </Link>
            {receipt.round_id && (
              <Link href={`/verify/${receipt.round_id}`} className={linkCls}>
                How the fair-play check works
              </Link>
            )}
            {!receipt.anonymized && (
              <Link href={`/r/${receipt.receipt_code}/delete`} className={linkCls}>
                Delete my data
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
