import Link from "next/link";
import type { ReactNode } from "react";
import { initials } from "@/lib/format";

/** Small ticket logo: yellow STREETPLAY on ink (or inverted on dark pages). */
export function Logo({ inverted = false, className = "" }: { inverted?: boolean; className?: string }) {
  return (
    <span
      className={`relative inline-flex items-center rounded-[6px] px-6 py-2 ${inverted ? "bg-yellow text-ink" : "bg-ink text-yellow"} ${className}`}
    >
      <span aria-hidden className="absolute top-1/2 -left-1.5 size-3 -translate-y-1/2 rounded-full bg-page" />
      <span className="font-wide text-[19px] leading-none tracking-tight">STREETPLAY</span>
      <span aria-hidden className="absolute top-1/2 -right-1.5 size-3 -translate-y-1/2 rounded-full bg-page" />
    </span>
  );
}

/** The big "ADMIT ONE …" ticket from the landing and viewer join screens. */
export function AdmitTicket({ line = "ADMIT ONE STRANGER", className = "" }: { line?: string; className?: string }) {
  return (
    <div className={`relative mx-auto w-fit rounded-[16px] bg-ink max-w-full px-8 py-3.5 text-left text-yellow ${className}`}>
      <span aria-hidden className="absolute top-1/2 -left-3 size-7 -translate-y-1/2 rounded-full bg-page" />
      <span aria-hidden className="absolute top-1/2 -right-3 size-7 -translate-y-1/2 rounded-full bg-page" />
      <span className="block font-mono text-[clamp(10px,2.9vw,12px)] tracking-[0.26em] whitespace-nowrap">{line}</span>
      <span className="font-wide block text-[clamp(24px,7.3vw,40px)] leading-[0.95] whitespace-nowrap">STREETPLAY</span>
    </div>
  );
}

/** Uppercase mono caption ("WALLET BALANCE", "ROUND 3 · VOTE"). */
export function Caption({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-label ${className}`}>{children}</p>;
}

/** Condensed headline ("HOW FAR, TOBI."). */
export function Headline({ children, className = "", as: As = "h1" }: { children: ReactNode; className?: string; as?: "h1" | "h2" | "p" }) {
  return <As className={`font-display ${className || "text-[clamp(44px,13vw,64px)]"}`}>{children}</As>;
}

/** "E DON LAND!" with the red offset shadow. */
export function Shout({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-shout ${className || "text-[clamp(44px,13vw,64px)]"}`}>{children}</p>;
}

/** Big naira figure in condensed type. Pass a preformatted string. */
export function Amount({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-display tabular leading-[0.85] ${className || "text-[clamp(64px,22vw,120px)]"}`}>{children}</p>;
}

export function Chip({
  selected = false,
  tone = "light",
  onClick,
  children,
  className = "",
}: {
  selected?: boolean;
  tone?: "light" | "dark";
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const base = "inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-5 text-[17px] font-bold whitespace-nowrap";
  const look =
    tone === "dark"
      ? selected
        ? "bg-yellow text-ink"
        : "border-2 border-smoke text-paper"
      : selected
        ? "bg-ink text-yellow"
        : "border-2 border-ink text-ink";
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`${base} ${look} ${className}`}>
      {selected && <span aria-hidden>✓</span>}
      {children}
    </button>
  );
}

/** Green circle tick (KYC steps, receipts). */
export function CheckDot({ size = "md", tone = "green" }: { size?: "sm" | "md"; tone?: "green" | "pending" | "empty" }) {
  const s = size === "sm" ? "size-7 text-sm" : "size-12 text-xl";
  if (tone === "pending") return <span className={`grid ${s} shrink-0 place-items-center rounded-full bg-ink font-bold text-yellow`}>···</span>;
  if (tone === "empty") return <span className={`block ${s} shrink-0 rounded-full border-2 border-muted`} />;
  return <span className={`grid ${s} shrink-0 place-items-center rounded-full bg-green text-ink`}>✓</span>;
}

export function Avatar({ name, tone = "yellow", size = 56 }: { name: string; tone?: "yellow" | "ink"; size?: number }) {
  return (
    <span
      className={`font-wide grid shrink-0 place-items-center rounded-full border-2 border-ink ${tone === "yellow" ? "bg-yellow text-ink" : "bg-ink text-yellow"}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

/** Two-tone bar (budget used, vote split). value 0–1. */
export function Bar({
  value,
  tone = "light",
  fill = "ink",
  className = "",
}: {
  value: number;
  tone?: "light" | "dark" | "outlined";
  fill?: "ink" | "yellow" | "paper";
  className?: string;
}) {
  const track = tone === "dark" ? "bg-smoke" : tone === "outlined" ? "border-2 border-ink bg-yellow" : "bg-sand";
  const bar = fill === "yellow" ? "bg-yellow" : fill === "paper" ? "bg-paper" : "bg-ink";
  return (
    <div className={`h-4 overflow-hidden rounded-full ${track} ${className}`}>
      <div className={`h-full rounded-full ${bar} transition-[width] duration-500`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

/** "● LIVE · 2,418" */
export function LiveBadge({ count, tone = "ink", ended = false }: { count?: number; tone?: "ink" | "smoke"; ended?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-[15px] font-semibold text-paper ${tone === "ink" ? "bg-ink" : "bg-smoke"}`}>
      {!ended && <span className="size-3 rounded-full bg-red" />}
      {ended ? "LIVE ENDED" : "LIVE"}
      {count !== undefined && ` · ${count.toLocaleString("en-NG")}`}
    </span>
  );
}

/** Header with back arrow, title and "2 of 4" step counter, ruled underneath. */
export function TopBar({
  title,
  back,
  close = false,
  right,
  dark = false,
}: {
  title: ReactNode;
  back?: string | (() => void);
  close?: boolean;
  right?: ReactNode;
  dark?: boolean;
}) {
  const icon = close ? "✕" : "←";
  const btn = "grid size-11 place-items-center text-[30px] leading-none";
  return (
    <header className={`flex items-center gap-4 border-b-[3px] px-5 pt-4 pb-4 ${dark ? "border-smoke" : "border-ink"}`}>
      {typeof back === "string" ? (
        <Link href={back} aria-label={close ? "Close" : "Back"} className={btn}>
          {icon}
        </Link>
      ) : back ? (
        <button type="button" onClick={back} aria-label={close ? "Close" : "Back"} className={btn}>
          {icon}
        </button>
      ) : null}
      <h1 className="font-wide flex-1 text-[24px] leading-tight">{title}</h1>
      {right && <span className="font-mono text-[15px]">{right}</span>}
    </header>
  );
}

/** A ruled list row: title + mono subline on the left, figure on the right. */
export function Row({
  title,
  sub,
  right,
  href,
  lead,
  className = "",
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  href?: string;
  lead?: ReactNode;
  className?: string;
}) {
  const inner = (
    <>
      {lead && <span className="w-14 shrink-0 font-mono text-[15px] opacity-70">{lead}</span>}
      <span className="min-w-0 flex-1">
        <span className="font-wide block text-[19px] leading-tight">{title}</span>
        {sub && <span className="mt-1 block font-mono text-[14px] opacity-70">{sub}</span>}
      </span>
      {right && <span className="font-mono text-[19px] font-semibold tabular">{right}</span>}
    </>
  );
  const cls = `flex items-center gap-4 border-b-2 border-current/90 py-4 ${className}`;
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** Mono "key ··· value" line inside receipts. */
export function KeyValue({ k, v, className = "" }: { k: ReactNode; v: ReactNode; className?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 font-mono text-[16px] ${className}`}>
      <span className="opacity-70">{k}</span>
      <span className="text-right font-semibold">{v}</span>
    </div>
  );
}

/** Centered column for phone layouts; full width on phones, phone-width on desktop. */
export function PhoneColumn({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto flex w-full max-w-[460px] flex-1 flex-col ${className}`}>{children}</div>;
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <span className="font-label sp-pulse">{label}…</span>
    </div>
  );
}
