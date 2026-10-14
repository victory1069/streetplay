import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLiveSessionServer } from "@/lib/data/public";
import { PlayApp } from "@/components/viewer/play-app";

export async function generateMetadata({ params }: PageProps<"/play/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  return { title: `Play along with @${decodeURIComponent(handle)}` };
}

export default async function PlayPage({ params }: PageProps<"/play/[handle]">) {
  const { handle } = await params;
  const session = await getLiveSessionServer(decodeURIComponent(handle));
  if (!session) notFound();
  return <PlayApp key={session.handle} initial={session} />;
}
