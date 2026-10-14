import type { Metadata } from "next";
import { Logo, PhoneColumn, Headline } from "@/components/ui";
import { ParticipantFlow } from "@/components/participant/participant-flow";
import { getParticipantView } from "@/lib/data/public";

export const metadata: Metadata = { title: "Your prize", robots: { index: false } };

export default async function ParticipantPage({ params }: PageProps<"/p/[code]">) {
  const { code } = await params;
  const view = await getParticipantView(code);
  if (!view) {
    return (
      <main className="theme-paper flex flex-1 flex-col">
        <PhoneColumn className="gap-6 px-5 pt-6 lg:pt-12">
          <Logo className="self-start" />
          <Headline className="mt-6 text-[clamp(48px,14vw,72px)]">LINK NOT FOUND.</Headline>
          <p className="text-[19px] leading-snug">This link doesn&apos;t exist. Ask the host for a new one.</p>
        </PhoneColumn>
      </main>
    );
  }
  return <ParticipantFlow initial={view} />;
}
