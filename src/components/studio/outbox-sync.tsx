"use client";

import { useEffect } from "react";
import { startOutboxSync } from "@/lib/offline/outbox";

// Flushes queued payouts on load and whenever the connection comes back.
export function OutboxSync() {
  useEffect(() => startOutboxSync(), []);
  return null;
}
