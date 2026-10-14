"use client";

import { useState } from "react";
import { Button, Headline } from "@/components/ui";

// "DON'T MISS THE NEXT LIVE" bottom sheet, shown once per device after the
// viewer's first answer. Own sheet markup so the viewer bundle skips the kit's
// interactive module.

export function InstallSheet({ handle, onInstall, onClose }: { handle: string; onInstall: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-ink/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-labelledby="install-title"
        className="theme-paper mx-auto w-full max-w-[520px] rounded-t-[28px] border-t-[3px] border-ink px-6 pt-4 pb-[calc(env(safe-area-inset-bottom)+24px)] text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-smoke" />
        <span className="relative mx-auto grid size-[84px] place-items-center overflow-hidden rounded-[22px] border-[3px] border-yellow bg-ink">
          <span aria-hidden className="absolute top-1/2 -left-3 size-6 -translate-y-1/2 rounded-full bg-paper" />
          <span aria-hidden className="absolute top-1/2 -right-3 size-6 -translate-y-1/2 rounded-full bg-paper" />
          <span className="font-wide text-[30px] text-yellow">SP</span>
        </span>
        <Headline as="h2" className="mt-6 text-[clamp(44px,13vw,60px)]">
          <span id="install-title">DON&apos;T MISS THE NEXT LIVE</span>
        </Headline>
        <p className="mt-4 text-[18px] leading-snug">Add StreetPlay to your home screen and we&apos;ll ping you when @{handle} starts a game.</p>
        <Button
          className="mt-6"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await onInstall();
            setBusy(false);
            onClose();
          }}
        >
          ADD TO HOME SCREEN
        </Button>
        <button type="button" onClick={onClose} className="font-wide mt-4 min-h-[44px] text-[18px] underline underline-offset-4">
          Not now
        </button>
      </div>
    </div>
  );
}
