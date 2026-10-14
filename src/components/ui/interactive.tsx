"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Seconds left until `endsAt` (ISO or ms), ticking every 250ms. Null when no deadline. */
export function useCountdown(endsAt: string | number | null | undefined): number | null {
  const target = endsAt == null ? null : typeof endsAt === "number" ? endsAt : new Date(endsAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (target == null) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [target]);
  return target == null ? null : Math.max(0, (target - now) / 1000);
}

/** A stopwatch counting up from when `running` became true. */
export function useStopwatch(running: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const t = window.setInterval(() => setElapsed((Date.now() - start) / 1000), 250);
    return () => {
      window.clearInterval(t);
      setElapsed(0);
    };
  }, [running]);
  return running ? elapsed : 0;
}

/**
 * Press and hold to confirm ("HOLD TO SEND"). Fills left to right; letting
 * go early cancels. Keeps money moves deliberate without a second dialog.
 */
export function HoldButton({
  onComplete,
  ms = 1200,
  className = "",
  fillClassName = "bg-ink/25",
  disabled,
  children,
}: {
  onComplete: () => void;
  ms?: number;
  className?: string;
  fillClassName?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [progress, setProgress] = useState(0);
  const raf = useRef<number | null>(null);

  const stop = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    setProgress(0);
  };
  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    [],
  );

  const start = () => {
    const began = performance.now();
    const loop = (now: number) => {
      const p = Math.min(1, (now - began) / ms);
      setProgress(p);
      if (p >= 1) {
        stop();
        navigator.vibrate?.(40);
        onComplete();
      } else raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onComplete();
      }}
      className={`relative overflow-hidden select-none ${className}`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 ${fillClassName}`} style={{ width: `${progress * 100}%` }} />
      <span className="relative">{children}</span>
    </button>
  );
}

/** Number pad for account numbers (pay winner screen). */
export function Keypad({ onKey, onDelete, onDone, doneDisabled }: { onKey: (d: string) => void; onDelete: () => void; onDone: () => void; doneDisabled?: boolean }) {
  const key = "grid h-[64px] place-items-center rounded-[12px] bg-coal font-display text-[40px] text-paper active:bg-smoke";
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
        <button key={d} type="button" className={key} onClick={() => onKey(d)}>
          {d}
        </button>
      ))}
      <button type="button" className={key} onClick={onDelete} aria-label="Delete">
        <span className="font-sans text-[30px]">⌫</span>
      </button>
      <button type="button" className={key} onClick={() => onKey("0")}>
        0
      </button>
      <button type="button" className={`${key} disabled:opacity-40`} onClick={onDone} disabled={doneDisabled} aria-label="Done">
        <span className="font-sans text-[32px]">✓</span>
      </button>
    </div>
  );
}

/** Bottom sheet over a dimmed page ("Don't miss the next Live"). */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-ink/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        className="theme-paper mx-auto w-full max-w-[520px] rounded-t-[28px] border-t-[3px] border-ink px-6 pt-4 pb-[calc(env(safe-area-inset-bottom)+24px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-smoke" />
        {children}
      </div>
    </div>
  );
}

/** Copy to clipboard with a brief "Copied" label. */
export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  return [
    copied,
    (text: string) => {
      void navigator.clipboard?.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    },
  ];
}

/** Web Share with clipboard fallback. */
export async function share(data: { title?: string; text?: string; url?: string; files?: File[] }): Promise<void> {
  if (navigator.share && (!data.files || navigator.canShare?.({ files: data.files }))) {
    try {
      await navigator.share(data);
      return;
    } catch {
      /* cancelled */
    }
  }
  await navigator.clipboard?.writeText([data.text, data.url].filter(Boolean).join(" "));
}

/** Triggers a file download in the browser. */
export function downloadFile(name: string, content: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
