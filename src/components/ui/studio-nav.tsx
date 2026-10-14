"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Studio bottom nav: Home · Episodes · Wallet · Account, active tab as a black pill.
const TABS = [
  { href: "/studio", label: "Home", match: (p: string) => p === "/studio" },
  { href: "/studio/episodes", label: "Episodes", match: (p: string) => p.startsWith("/studio/episodes") },
  { href: "/studio/wallet", label: "Wallet", match: (p: string) => p.startsWith("/studio/wallet") },
  { href: "/studio/account", label: "Account", match: (p: string) => p.startsWith("/studio/account") },
];

export function StudioNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-20 grid grid-cols-4 gap-2 border-t-[3px] border-ink bg-paper px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      {TABS.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`grid h-12 place-items-center rounded-full font-mono text-[16px] font-semibold ${active ? "bg-ink text-yellow" : "text-ink"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
