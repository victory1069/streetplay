import { createClient } from "./client";
import { idb } from "@/lib/offline/idb";

/**
 * Signs out and wipes cached pages and data so the next person on this phone
 * can't see them. Queued payouts are kept: they're the host's money.
 */
export async function signOut(): Promise<void> {
  await createClient().auth.signOut();
  const cached = await idb.all<{ id: string }>("cache").catch(() => []);
  await Promise.all(cached.map((c) => idb.delete("cache", c.id)));
  navigator.serviceWorker?.controller?.postMessage({ type: "clear-pages" });
  // Full reload on purpose: drops all in-memory state from the previous user.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  location.assign("/");
}
