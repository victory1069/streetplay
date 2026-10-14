import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, fail, rateLimit, readJson, tooMany } from "@/lib/server/http";
import { currentFan } from "@/lib/live/viewer-auth";
import {
  ARTIST_BONUS,
  TEXT_DOUBLE_FIRST,
  TEXT_POINTS,
  VOTE_POINTS,
  answerMatches,
  quizPoints,
} from "@/lib/games/scoring";
import type { LivePrompt, RespondResult } from "@/types/domain";

// A vote, prediction or answer. First response counts. Free to play, always
// (spec: no paid entry, ever). Quiz and text answers are judged here against
// the secret answer, so the viewer sees "✓ +140 · 1.2s" straight away;
// predictions score at the reveal (resolve_prompt).
export async function POST(request: Request, { params }: RouteContext<"/api/live/[handle]/respond">) {
  const { handle } = await params;
  const admin = createAdminClient();
  const ctx = await currentFan(admin, handle);
  if (!ctx) return fail(401, "not_joined", "Join the game first.");
  if (!(await rateLimit(`respond:${ctx.fan.id}`, 30, 60))) return tooMany();

  const body = await readJson<{ promptId: string; option: number; text: string; artist: string }>(request);
  if (!body.promptId) return badRequest("promptId is required.");

  const { data: prompt } = await admin
    .from("live_prompts")
    .select("*, episode:episodes!inner(creator_id)")
    .eq("id", body.promptId)
    .maybeSingle<LivePrompt & { episode: { creator_id: string } }>();
  if (!prompt || prompt.episode.creator_id !== ctx.fan.creator_id) return fail(404, "not_found", "That question isn't running.");

  const now = Date.now();
  const elapsed = now - new Date(prompt.opened_at).getTime();
  const closed = prompt.status !== "open" || (prompt.closes_at !== null && new Date(prompt.closes_at).getTime() < now);
  if (closed) return fail(409, "closed", "Too late, this one's closed.");

  let option: number | null = null;
  let text: string | null = null;
  let correct: boolean | null = null;
  let points = 0;
  let doubleFirst = 0;

  if (prompt.kind === "text") {
    text = (body.text ?? "").trim().slice(0, 120);
    if (!text) return badRequest("Type your answer.");
    const { data: secret } = await admin.from("live_prompt_secrets").select("answer, artist").eq("prompt_id", prompt.id).maybeSingle();
    correct = secret?.answer ? answerMatches(text, secret.answer) : null;
    if (correct) {
      points = TEXT_POINTS + (secret?.artist && body.artist && answerMatches(body.artist, secret.artist) ? ARTIST_BONUS : 0);
      doubleFirst = TEXT_DOUBLE_FIRST;
    }
  } else {
    if (!Number.isInteger(body.option) || body.option! < 0 || body.option! >= prompt.options.length) {
      return badRequest("Not a valid option.");
    }
    option = body.option!;
    if (prompt.kind === "vote") points = VOTE_POINTS;
    if (prompt.kind === "quiz") {
      const { data: secret } = await admin.from("live_prompt_secrets").select("correct_option").eq("prompt_id", prompt.id).maybeSingle();
      correct = secret?.correct_option === option;
      points = correct ? quizPoints(elapsed, prompt.duration_seconds ?? 15) : 0;
    }
    // predict: scored at the reveal (resolve_prompt, +100).
  }

  const { data: rows, error } = await admin.rpc("record_response", {
    p_prompt: prompt.id,
    p_fan: ctx.fan.id,
    p_option: option,
    p_text: text,
    p_correct: correct,
    p_points: points,
    p_double_first: doubleFirst,
  });
  if (error) return fail(500, "server_error", "Couldn't save that. Try again.");
  const rec = (rows as { inserted: boolean; points: number; correct: boolean | null }[])[0];

  const { data: score } = await admin
    .from("fan_scores")
    .select("points")
    .eq("episode_id", prompt.episode_id)
    .eq("fan_id", ctx.fan.id)
    .maybeSingle();

  const result: RespondResult = {
    points: rec.points,
    correct: prompt.kind === "vote" || prompt.kind === "predict" ? null : rec.correct,
    elapsed_ms: elapsed,
    total: score?.points ?? 0,
  };
  return Response.json(result);
}
