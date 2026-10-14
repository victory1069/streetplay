import type { ReactNode } from "react";

// The signature shape: a card with semicircle notches punched out of both
// sides, usually at a dashed tear line between a body and a stub.
// Notches take the page colour from --page (set by .theme-* classes).

type Tone = "ink" | "yellow" | "card" | "coal" | "paper";

const TONES: Record<Tone, string> = {
  ink: "bg-ink text-paper",
  yellow: "bg-yellow text-ink",
  card: "bg-card text-ink",
  coal: "bg-coal text-paper",
  paper: "bg-paper text-ink",
};

const DIVIDERS: Record<Tone, string> = {
  ink: "border-smoke",
  yellow: "border-ink",
  card: "border-ink",
  coal: "border-smoke",
  paper: "border-ink",
};

export function Ticket({
  tone = "ink",
  outline = false,
  notch = "middle",
  stub,
  className = "",
  bodyClassName = "p-6",
  stubClassName = "px-6 py-4",
  children,
}: {
  tone?: Tone;
  /** 3px ink border, like the outlined yellow tickets. */
  outline?: boolean;
  /** Where the notches go when there's no stub. */
  notch?: "middle" | "none";
  /** Bottom section under a dashed tear line; notches sit on the line. */
  stub?: ReactNode;
  className?: string;
  bodyClassName?: string;
  stubClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={`relative rounded-[18px] ${TONES[tone]} ${outline ? "border-[3px] border-ink" : ""} ${className}`}>
      <div className={bodyClassName}>{children}</div>
      {stub !== undefined ? (
        <div className={`relative mx-6 border-t-2 border-dashed ${DIVIDERS[tone]}`}>
          <Notches outline={outline} />
          <div className={`-mx-6 ${stubClassName}`}>{stub}</div>
        </div>
      ) : notch === "middle" ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/2">
          <Notches outline={outline} />
        </div>
      ) : null}
    </div>
  );
}

function Notches({ outline }: { outline: boolean }) {
  const base = `absolute top-0 size-7 -translate-y-1/2 rounded-full bg-page ${outline ? "border-[3px] border-ink" : ""}`;
  return (
    <>
      <span aria-hidden className={`${base} ${outline ? "-left-[calc(1.5rem+17px)]" : "-left-[calc(1.5rem+14px)]"}`} />
      <span aria-hidden className={`${base} ${outline ? "-right-[calc(1.5rem+17px)]" : "-right-[calc(1.5rem+14px)]"}`} />
    </>
  );
}

/** Notches for a ticket without the stub wrapper (e.g. a full-width row). */
export function SideNotches({ outline = false }: { outline?: boolean }) {
  const base = `absolute top-1/2 size-7 -translate-y-1/2 rounded-full bg-page ${outline ? "border-[3px] border-ink" : ""}`;
  return (
    <>
      <span aria-hidden className={`${base} -left-3.5`} />
      <span aria-hidden className={`${base} -right-3.5`} />
    </>
  );
}
