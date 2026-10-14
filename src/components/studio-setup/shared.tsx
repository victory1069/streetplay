import type { Episode, FormatId } from "@/types/domain";

// Small pieces shared by the studio screens (home, wallet, wizard, account).

export const episodeLabel = (e: Pick<Episode, "number" | "title">) => `Ep ${e.number} · ${e.title}`;

export const FORMAT_CATEGORY: Partial<Record<FormatId, "Music" | "Quiz" | "Chance">> = {
  "finish-the-lyric": "Music",
  "name-the-song": "Music",
  "money-ladder": "Quiz",
  "quickfire-trivia": "Quiz",
  "pick-a-box": "Chance",
  "spin-the-wheel": "Chance",
};

export const errorMessage = (err: unknown, fallback = "Something went wrong. Try again.") =>
  err instanceof Error && err.message ? err.message : typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : fallback;

/** "TODAY 3:00 PM" for the next-episode ticket. */
export function whenUpper(iso: string | null | undefined, label: string): string {
  if (!iso) return "";
  const day = label.split(" ")[0];
  const time = new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });
  return `${day} ${time}`.toUpperCase();
}

/** The next episode to play: live first, then the soonest upcoming draft, else the newest draft. */
export function nextEpisode(episodes: Episode[]): Episode | null {
  const open = episodes.filter((e) => e.status !== "wrapped");
  const live = open.find((e) => e.status === "live");
  if (live) return live;
  const timed = open.filter((e) => e.starts_at).sort((a, b) => a.starts_at!.localeCompare(b.starts_at!));
  return timed[0] ?? open[0] ?? null;
}
