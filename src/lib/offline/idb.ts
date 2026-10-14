// Minimal promise wrapper over IndexedDB. Client-only.
//   rounds   local copy of rounds so a game screen opens with no signal
//   outbox   queued payouts (lib/offline/outbox)
//   sync     queued writes for rounds/consents/clip markers (lib/offline/sync)
//   cache    small read-through cache (bank list, episode, packs)

const DB_NAME = "streetplay";
const DB_VERSION = 2;

export const STORES = ["episodes", "rounds", "outbox", "markers", "sync", "cache"] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const name of STORES) {
        if (!req.result.objectStoreNames.contains(name)) {
          req.result.createObjectStore(name, { keyPath: "id" });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(store, mode).objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const idb = {
  get: <T>(store: StoreName, id: string) => run<T | undefined>(store, "readonly", (s) => s.get(id)),
  all: <T>(store: StoreName) => run<T[]>(store, "readonly", (s) => s.getAll()),
  put: <T extends { id: string }>(store: StoreName, value: T) => run(store, "readwrite", (s) => s.put(value)),
  delete: (store: StoreName, id: string) => run(store, "readwrite", (s) => s.delete(id)),
};

/** Read-through cache: returns fresh data when online, the last copy when not. */
export async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  try {
    const value = await load();
    void idb.put("cache", { id: key, value, at: Date.now() }).catch(() => {});
    return value;
  } catch (err) {
    const hit = await idb.get<{ value: T }>("cache", key).catch(() => undefined);
    if (hit) return hit.value;
    throw err;
  }
}
