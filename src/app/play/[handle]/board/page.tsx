import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLiveSessionServer } from "@/lib/data/public";
import { Board } from "@/components/viewer/board";

export async function generateMetadata({ params }: PageProps<"/play/[handle]/board">): Promise<Metadata> {
  const { handle } = await params;
  return { title: `Top players · @${decodeURIComponent(handle)}` };
}

export default async function BoardPage({ params }: PageProps<"/play/[handle]/board">) {
  const { handle } = await params;
  const session = await getLiveSessionServer(decodeURIComponent(handle));
  if (!session) notFound();
  return <Board initial={session} />;
}
