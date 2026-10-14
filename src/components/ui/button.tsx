import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// Big one-thumb buttons. "display" font = condensed uppercase CTA
// ("GET STARTED →"); "bold" = wide bold sentence case ("Show QR").

export type ButtonVariant = "ink" | "yellow" | "cream" | "outline" | "outline-light" | "green" | "red" | "red-outline" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  ink: "bg-ink text-yellow",
  yellow: "bg-yellow text-ink",
  cream: "bg-paper text-ink",
  outline: "border-[3px] border-ink text-ink bg-transparent",
  "outline-light": "border-2 border-paper text-paper bg-transparent",
  green: "bg-green text-ink",
  red: "bg-red text-paper",
  "red-outline": "border-2 border-red text-paper bg-transparent",
  ghost: "bg-transparent underline underline-offset-4",
};

const SIZES = {
  lg: "min-h-[60px] px-6 text-[30px]",
  md: "min-h-[52px] px-5 text-[22px]",
  sm: "min-h-[44px] px-4 text-base",
};

export interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: keyof typeof SIZES;
  font?: "display" | "bold";
  block?: boolean;
  className?: string;
}

export function buttonClass({ variant = "ink", size = "lg", font = "display", block = true, className = "" }: ButtonStyleProps): string {
  const type = font === "display" ? "font-display" : "font-wide text-[0.68em] tracking-tight";
  return [
    "inline-flex items-center justify-center gap-3 rounded-[14px] text-center transition-[transform,opacity] active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100",
    VARIANTS[variant],
    SIZES[size],
    type,
    block ? "w-full" : "",
    className,
  ].join(" ");
}

export function Button({
  variant,
  size,
  font,
  block,
  className,
  loading,
  children,
  ...rest
}: ButtonStyleProps & ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button {...rest} disabled={rest.disabled || loading} className={buttonClass({ variant, size, font, block, className })}>
      {loading ? <span className="sp-pulse">…</span> : children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant,
  size,
  font,
  block,
  className,
  children,
}: ButtonStyleProps & { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass({ variant, size, font, block, className })}>
      {children}
    </Link>
  );
}

/** "→" sized to sit next to condensed caps. */
export const Arrow = () => <span className="font-sans font-normal">→</span>;
