import type { ContentPack, Question, SongCard } from "@/types/domain";
import { QUESTION_PACKS } from "./question-packs";
import { SONG_PACKS } from "./song-packs";

export { QUESTION_PACKS, SONG_PACKS };
export const ALL_PACKS: ContentPack[] = [...QUESTION_PACKS, ...SONG_PACKS];

export function packById(id: string): ContentPack | undefined {
  return ALL_PACKS.find((p) => p.id === id);
}

/** Questions from the episode's picked packs plus the creator's own. */
export function questionsFor(packIds: string[], custom: Question[] = []): Question[] {
  return [...QUESTION_PACKS.filter((p) => packIds.includes(p.id)).flatMap((p) => p.items), ...custom];
}

export function songsFor(packIds: string[]): SongCard[] {
  return SONG_PACKS.filter((p) => packIds.includes(p.id)).flatMap((p) => p.items);
}
