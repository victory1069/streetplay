// Offline write queue for game data (spec: "games run fully offline").
// Rounds, consents and clip markers are written locally first with
// client-generated ids, then pushed to Supabase in order when online.
// Inserts are idempotent (ON CONFLICT DO NOTHING), so replays are safe.

import { idb } from "./idb";
import { createClient } from "@/lib/supabase/client";

type Table = "rounds" | "consents" | "clip_markers";

interface SyncItem {
  id: string; // queue item id
  seq: number;
  table: Table;
  op: "insert" | "update";
  rowId: string;
  values: Record<string, unknown>;
}

const events = new EventTarget();
export const onSyncChange = (cb: () => void) => {
  events.addEventListener("change", cb);
  return () => events.removeEventListener("change", cb);
};

// Strictly increasing across calls in the same millisecond, so a round is
// always pushed before the consent that references it.
let lastSeq = 0;
function nextSeq(): number {
  lastSeq = Math.max(Date.now() * 1000, lastSeq + 1);
  return lastSeq;
}

export async function enqueueWrite(table: Table, op: "insert" | "update", rowId: string, values: Record<string, unknown>) {
  const item: SyncItem = { id: crypto.randomUUID(), seq: nextSeq(), table, op, rowId, values };
  await idb.put("sync", item);
  events.dispatchEvent(new Event("change"));
  void flushSync();
}

export async function pendingWrites(): Promise<number> {
  return (await idb.all("sync")).length;
}

let flushing: Promise<void> | null = null;

/** Pushes queued writes in order. Payouts flush after this (FKs on rounds). */
export function flushSync(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const supabase = createClient();
    const items = (await idb.all<SyncItem>("sync")).sort((a, b) => a.seq - b.seq);
    for (const item of items) {
      const q =
        item.op === "insert"
          ? supabase.from(item.table).upsert({ id: item.rowId, ...item.values }, { onConflict: "id", ignoreDuplicates: true })
          : supabase.from(item.table).update(item.values).eq("id", item.rowId);
      const { error } = await q;
      if (error) {
        // Network trouble: stop and retry later. A refused write (RLS,
        // constraint) would block the queue forever, so drop it loudly.
        if (/fetch|network|Failed to fetch/i.test(error.message)) break;
        console.error(`sync: dropping ${item.op} on ${item.table}`, error.message);
      }
      await idb.delete("sync", item.id);
      events.dispatchEvent(new Event("change"));
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
