import Link from "next/link";
import type { ReactNode } from "react";
import { CheckDot } from "@/components/ui";
import { ONBOARDING_STEPS } from "@/lib/onboarding";

/**
 * Header for the three setup steps: back arrow, title, "Step 2 of 3" and a
 * segmented bar labelled Your show · Wallet · Fund.
 */
export function OnboardingHeader({ step, title, back }: { step: 1 | 2 | 3; title: string; back?: string | (() => void) }) {
  const backEl =
    typeof back === "string" ? (
      <Link href={back} aria-label="Back" className="grid size-11 place-items-center text-[30px] leading-none">
        ←
      </Link>
    ) : back ? (
      <button type="button" onClick={back} aria-label="Back" className="grid size-11 place-items-center text-[30px] leading-none">
        ←
      </button>
    ) : (
      <span className="size-11" aria-hidden />
    );

  return (
    <header className="border-b-[3px] border-ink px-5 pt-4 pb-4">
      <div className="flex items-center gap-3">
        {backEl}
        <h1 className="font-wide min-w-0 flex-1 truncate text-[clamp(18px,5.4vw,22px)] leading-tight">{title}</h1>
        <span className="shrink-0 font-mono text-[14px]">
          Step {step} of {ONBOARDING_STEPS.length}
        </span>
      </div>
      <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Setup progress">
        {ONBOARDING_STEPS.map((s, i) => {
          const state = i + 1 < step ? "done" : i + 1 === step ? "current" : "todo";
          return (
            <li key={s.id} aria-current={state === "current" ? "step" : undefined}>
              <span className={`block h-2 rounded-full ${state === "todo" ? "bg-sand" : state === "current" ? "bg-ink" : "bg-green"}`} />
              <span className={`mt-1.5 block font-mono text-[12px] tracking-wide uppercase ${state === "todo" ? "opacity-50" : ""}`}>
                {state === "done" ? "✓ " : ""}
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </header>
  );
}

export interface ChecklistItem {
  label: string;
  done: boolean;
  href: string;
  /** Shown under the label while not done. */
  hint?: ReactNode;
}

/** "Finish setting up" card on Home until the first episode is planned. */
export function SetupChecklist({ items }: { items: ChecklistItem[] }) {
  const doneCount = items.filter((i) => i.done).length;
  const nextIdx = items.findIndex((i) => !i.done);
  return (
    <section className="mt-5 rounded-[18px] border-[3px] border-ink bg-card">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-4">
        <p className="font-label">Finish setting up</p>
        <p className="font-mono text-[14px]">
          {doneCount} of {items.length}
        </p>
      </div>
      <ul className="mt-2">
        {items.map((item, i) => {
          const isNext = i === nextIdx;
          const inner = (
            <>
              {item.done ? (
                <CheckDot size="sm" />
              ) : (
                <span className={`grid size-7 shrink-0 place-items-center rounded-full border-2 font-mono text-[13px] ${isNext ? "border-ink bg-ink text-yellow" : "border-muted"}`}>
                  {i + 1}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className={`font-wide block text-[17px] leading-tight ${item.done ? "line-through opacity-50" : ""}`}>{item.label}</span>
                {!item.done && isNext && item.hint && <span className="mt-0.5 block text-[14px] opacity-70">{item.hint}</span>}
              </span>
              {!item.done && <span aria-hidden className="text-[22px]">→</span>}
            </>
          );
          const cls = `flex min-h-[56px] items-center gap-4 border-t-2 border-ink/15 px-5 py-3 ${isNext ? "bg-yellow/40" : ""}`;
          return (
            <li key={item.label}>
              {item.done ? (
                <div className={cls}>{inner}</div>
              ) : (
                <Link href={item.href} className={cls}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
