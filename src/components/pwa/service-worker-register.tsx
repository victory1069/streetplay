"use client";

import { useEffect } from "react";

// Registers public/sw.js in production only. In dev a caching worker hides
// your edits, so we also unregister any worker left over from a prod build.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((err) => console.error("Service worker registration failed", err));
  }, []);

  return null;
}
