// Temporary stand-in for screens not yet designed. Delete once every route
// has its real screen: `grep -r ScreenPlaceholder src/app` shows what's left.
export function ScreenPlaceholder({
  title,
  surface,
  notes,
  params,
  data,
}: {
  title: string;
  surface: "crew" | "viewer" | "participant" | "public" | "overlay" | "sponsor";
  notes: string[];
  params?: Record<string, string>;
  /** Real data the screen will render, shown raw until it's designed. */
  data?: unknown;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-6">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">{surface} screen · placeholder</p>
      <h1 className="text-3xl font-bold">{title}</h1>
      {params && (
        <pre className="rounded-lg bg-surface p-3 font-mono text-xs text-muted">{JSON.stringify(params, null, 2)}</pre>
      )}
      {data !== undefined && (
        <pre className="overflow-x-auto rounded-lg bg-surface p-3 font-mono text-xs">{JSON.stringify(data, null, 2)}</pre>
      )}
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </main>
  );
}

export function ScreenLoading() {
  return <main className="flex flex-1 items-center justify-center p-6 text-muted">Loading…</main>;
}
