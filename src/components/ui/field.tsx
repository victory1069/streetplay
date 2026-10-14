import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

// Form pieces: mono uppercase label over a chunky bordered box.

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-label block ${className}`}>{children}</span>;
}

export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label && <Label className="mb-2.5">{label}</Label>}
      {children}
      {hint && !error && <span className="mt-2 block text-[15px] leading-snug opacity-70">{hint}</span>}
      {error && <span className="mt-2 block text-[15px] font-semibold text-red">{error}</span>}
    </label>
  );
}

const box = "w-full rounded-[14px] border-[3px] bg-card px-5 text-ink outline-none transition-colors";

export function Input({
  tone = "light",
  big = false,
  mono = false,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { tone?: "light" | "dark"; big?: boolean; mono?: boolean }) {
  return (
    <input
      {...rest}
      className={[
        box,
        big ? "h-[68px] text-[28px]" : "h-[60px] text-[22px]",
        mono ? "font-mono tracking-wide" : "font-bold",
        tone === "dark" ? "border-smoke bg-paper focus:border-yellow" : "border-ink focus:border-ink",
        "placeholder:font-normal placeholder:text-muted/60",
        className,
      ].join(" ")}
    />
  );
}

/** +234 prefix field from the landing and claim screens. */
export function PhoneInput({ tone = "light", className = "", ...rest }: InputHTMLAttributes<HTMLInputElement> & { tone?: "light" | "dark" }) {
  return (
    <div
      className={[
        "flex h-[68px] items-center gap-4 rounded-[14px] border-[3px] px-6",
        tone === "dark" ? "border-yellow bg-paper" : "border-ink bg-card",
        className,
      ].join(" ")}
    >
      <span className="text-[22px] font-semibold text-muted">+234</span>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        {...rest}
        className="h-full min-w-0 flex-1 bg-transparent text-[28px] font-bold text-ink outline-none placeholder:font-normal placeholder:text-muted/50"
      />
    </div>
  );
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...rest}
        className={`${box} h-[60px] appearance-none border-ink pr-12 text-[22px] font-bold ${className}`}
      >
        {children}
      </select>
      <span aria-hidden className="pointer-events-none absolute top-1/2 right-6 -translate-y-1/2 text-xs">
        ▼
      </span>
    </div>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-4 text-[17px] leading-snug">
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border-2 border-ink ${checked ? "bg-ink text-yellow" : "bg-card"}`}
      >
        {checked ? "✓" : ""}
      </span>
      <span>{children}</span>
    </label>
  );
}

/** Six boxes for a claim code ("4 8 2 9 1 3"). */
export function CodeBoxes({ value, onChange, length = 6 }: { value: string; onChange: (v: string) => void; length?: number }) {
  return (
    <label className="relative block">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
        inputMode="numeric"
        autoComplete="one-time-code"
        className="absolute inset-0 opacity-0"
        aria-label="Code"
      />
      <span className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}>
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            className={`grid aspect-[9/10] place-items-center lg:aspect-[4/3] rounded-[12px] border-[3px] border-ink bg-card font-mono text-[32px] font-semibold ${i === value.length ? "ring-2 ring-yellow" : ""}`}
          >
            {value[i] ?? ""}
          </span>
        ))}
      </span>
    </label>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-[15px] font-semibold text-red">
      {children}
    </p>
  );
}
