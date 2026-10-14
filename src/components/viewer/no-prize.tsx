import { Headline, Logo, PhoneColumn } from "@/components/ui";

/** Shown when a /win code doesn't match any prize. */
export function NoPrize() {
  return (
    <main className="theme-ink flex flex-1 flex-col">
      <PhoneColumn className="gap-6 px-5 pt-6 lg:pt-12">
        <Logo inverted className="self-start" />
        <Headline className="mt-6 text-[clamp(48px,14vw,72px)] text-paper">NO PRIZE HERE.</Headline>
        <p className="text-[19px] leading-snug text-paper/80">That code doesn&apos;t match any prize. Check the link in your notification.</p>
      </PhoneColumn>
    </main>
  );
}
