"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const noopSubscribe = () => () => {};
const getPlatform = () => ({
  isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
  isStandalone: window.matchMedia("(display-mode: standalone)").matches,
});
// Stable snapshots so useSyncExternalStore doesn't loop.
let platform: ReturnType<typeof getPlatform> | null = null;
const clientSnapshot = () => (platform ??= getPlatform());
const serverSnapshot = () => ({ isIOS: false, isStandalone: true });

// Host-only install nudge. Android/Chrome gets a button via
// beforeinstallprompt; iOS gets Share → Add to Home Screen instructions.
export function InstallPrompt() {
  const { isIOS, isStandalone } = useSyncExternalStore(noopSubscribe, clientSnapshot, serverSnapshot);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (isStandalone) return null;

  if (deferred) {
    return (
      <button
        type="button"
        className="rounded-xl bg-accent px-4 py-3 font-semibold text-black"
        onClick={async () => {
          await deferred.prompt();
          setDeferred(null);
        }}
      >
        Install StreetPlay
      </button>
    );
  }

  if (isIOS) {
    return (
      <p className="text-sm text-muted">
        To install, tap Share and then &ldquo;Add to Home Screen&rdquo;.
      </p>
    );
  }

  return null;
}
