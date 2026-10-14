"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Caption, ErrorText, Field, Input, PhoneColumn, Spinner, TopBar } from "@/components/ui";
import { useStudio } from "@/components/studio/studio-context";
import { addCustomQuestion, deleteCustomQuestion, listCustomQuestions } from "@/lib/data/studio";
import type { Question } from "@/types/domain";
import { errorMessage } from "./shared";

export function Packs() {
  const router = useRouter();
  const ctx = useStudio();
  const [items, setItems] = useState<Question[] | null>(null);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [wrong, setWrong] = useState(["", "", ""]);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const creatorId = ctx?.creator.id;

  const load = useCallback(async () => {
    if (!creatorId) return;
    const list = await listCustomQuestions(creatorId).catch(() => [] as Question[]);
    setItems(list);
  }, [creatorId]);

  useEffect(() => {
    if (!creatorId) return;
    let alive = true;
    listCustomQuestions(creatorId)
      .catch(() => [] as Question[])
      .then((list) => alive && setItems(list));
    return () => {
      alive = false;
    };
  }, [creatorId]);

  const back = () => (window.history.length > 1 ? router.back() : router.push("/studio/episodes/new"));

  return (
    <main className="theme-paper flex flex-1 flex-col">
      <PhoneColumn>
        <TopBar back={back} title="Write your own" right={items ? `${items.length} added` : undefined} />
        <div className="flex flex-1 flex-col px-7 pt-6 pb-[calc(env(safe-area-inset-bottom)+24px)]">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!creatorId) return;
              if (!prompt.trim() || !answer.trim()) return setError("Add a question and its answer.");
              const others = wrong.map((w) => w.trim()).filter(Boolean);
              setBusy(true);
              setError(null);
              try {
                await addCustomQuestion(creatorId, {
                  prompt: prompt.trim(),
                  answer: answer.trim(),
                  choices: others.length ? [answer.trim(), ...others] : undefined,
                });
                setPrompt("");
                setAnswer("");
                setWrong(["", "", ""]);
                await load();
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Question">
              <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Which bus stop is after Ojuelegba?" />
            </Field>
            <Field label="Answer">
              <Input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Barracks" />
            </Field>
            <Field label="Wrong options · up to 3" hint="Leave empty for open answer questions.">
              <div className="space-y-2">
                {wrong.map((w, i) => (
                  <Input
                    key={i}
                    value={w}
                    onChange={(e) => setWrong((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={`Wrong option ${i + 1}`}
                    aria-label={`Wrong option ${i + 1}`}
                    className="!h-[52px] !text-[19px]"
                  />
                ))}
              </div>
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" loading={busy} size="md">
              + Add question
            </Button>
          </form>

          <Caption className="mt-8 mb-3">Your questions</Caption>
          <div className="border-t-2 border-ink">
            {items === null ? (
              <Spinner />
            ) : items.length === 0 ? (
              <p className="py-5 text-[17px] opacity-70">None yet. Street questions get the best reactions.</p>
            ) : (
              items.map((q) => (
                <div key={q.id} className="flex items-center gap-4 border-b-2 border-ink py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-wide text-[18px] leading-tight">{q.prompt}</p>
                    <p className="mt-1 font-mono text-[14px] opacity-70">
                      {q.answer}
                      {q.choices ? ` · ${q.choices.length} options` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={deleting === q.id}
                    onClick={async () => {
                      setDeleting(q.id);
                      setError(null);
                      try {
                        await deleteCustomQuestion(q.id);
                        await load();
                      } catch (err) {
                        setError(errorMessage(err));
                      } finally {
                        setDeleting(null);
                      }
                    }}
                    className="grid size-11 shrink-0 place-items-center text-[22px] disabled:opacity-40"
                    aria-label={`Delete "${q.prompt}"`}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </PhoneColumn>
    </main>
  );
}
