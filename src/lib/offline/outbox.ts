// Offline payout queue (spec § Lagos realities).
// A payout is saved locally first with its idempotency key, then posted to
// /api/payouts. The server treats a repeated key as the same payout, so a
// retry after a dropped connection can never pay twice.

import { idb } from "./idb";
import { flushSync } from "./sync";
import type { Payout, PayoutDraft } from "@/types/domain";

export interface OutboxItem {
  id: string; // = draft.idempotency_key
  draft: PayoutDraft;
  /** For the "queued" screen while offline: "Bisi A." · Kuda */
  label: { name: string; bank: string | null };
  /** queued: not confirmed by the server yet. done: server has a final answer. */
  state: "queued" | "done" | "failed";
  payout?: Payout;
  error?: string;
  updatedAt: string;
}

const events = new EventTarget();

/** Subscribe to outbox changes (for "2 queued" badges). Returns an unsubscribe fn. */
export function onOutboxChange(cb: () => void): () => void {
  events.addEventListener("change", cb);
  return () => events.removeEventListener("change", cb);
}

async function save(item: OutboxItem) {
  await idb.put("outbox", { ...item, updatedAt: new Date().toISOString() });
  events.dispatchEvent(new Event("change"));
}

/** The only way the app sends money. Returns immediately; poll or subscribe for the result. */
export async function enqueuePayout(
  draft: Omit<PayoutDraft, "idempotency_key">,
  label: OutboxItem["label"],
): Promise<OutboxItem> {
  const id = crypto.randomUUID();
  const item: OutboxItem = { id, draft: { ...draft, idempotency_key: id }, label, state: "queued", updatedAt: "" };
  await save(item);
  void flushOutbox();
  return item;
}

export async function outboxItems(): Promise<OutboxItem[]> {
  return (await idb.all<OutboxItem>("outbox")).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function outboxItem(id: string): Promise<OutboxItem | undefined> {
  return idb.get<OutboxItem>("outbox", id);
}

export async function queuedCount(episodeId?: string): Promise<number> {
  return (await outboxItems()).filter((i) => i.state === "queued" && (!episodeId || i.draft.episode_id === episodeId)).length;
}

let flushing = false;

export async function flushOutbox(): Promise<void> {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    await flushSync(); // rounds must exist before payouts reference them
    const queued = (await outboxItems()).filter((i) => i.state === "queued");
    for (const item of queued) {
      let res: Response;
      try {
        res = await fetch("/api/payouts", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": item.id },
          body: JSON.stringify(item.draft),
        });
      } catch {
        break; // network dropped: try again on the next flush
      }

      if (res.status === 401 || res.status >= 500) break; // signed out or server trouble: keep queued

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        await save({ ...item, state: "failed", error: body.message ?? `Error ${res.status}` });
        continue;
      }
      const payout = body as Payout;
      // "sending" means the provider hasn't confirmed yet; posting again resumes it.
      await save({ ...item, payout, state: payout.status === "sending" ? "queued" : "done" });
    }
  } finally {
    flushing = false;
  }
}

/** Call once from the studio app shell. */
export function startOutboxSync(): () => void {
  const flush = () => void flushOutbox();
  window.addEventListener("online", flush);
  const timer = window.setInterval(flush, 15_000);
  flush();
  return () => {
    window.removeEventListener("online", flush);
    window.clearInterval(timer);
  };
}
