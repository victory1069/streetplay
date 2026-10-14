"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { share } from "@/components/ui/interactive";

/** Re-fetches the server page every `ms` (pending receipts). */
export function AutoRefresh({ ms = 10_000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = window.setInterval(() => router.refresh(), ms);
    return () => window.clearInterval(t);
  }, [router, ms]);
  return null;
}

export interface ReceiptImageData {
  status: string;
  amount: string;
  line: string;
  rows: [string, string][];
  code: string;
}

/** Draws the receipt card to a PNG with a plain canvas (no libraries). */
async function receiptPng(d: ReceiptImageData): Promise<File | null> {
  const css = getComputedStyle(document.documentElement);
  const sans = `${css.getPropertyValue("--font-archivo").trim() || "system-ui"}, system-ui, sans-serif`;
  const mono = `${css.getPropertyValue("--font-plex-mono").trim() || "monospace"}, monospace`;
  const W = 720;
  const H = 760;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  if (!g) return null;

  g.fillStyle = "#fdc52d";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#131211";
  g.font = `800 34px ${sans}`;
  g.fillText("STREETPLAY", 48, 82);

  const x = 40;
  const y = 120;
  const w = W - 80;
  const h = 580;
  g.beginPath();
  g.roundRect(x, y, w, h, 28);
  g.fillStyle = "#fdfaf2";
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = "#131211";
  g.stroke();

  g.fillStyle = "#1e9e5a";
  g.beginPath();
  g.arc(x + 58, y + 64, 18, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#131211";
  g.font = `700 22px ${sans}`;
  g.fillText("✓", x + 50, y + 72);
  g.fillStyle = "#157a45";
  g.font = `600 24px ${mono}`;
  g.fillText(d.status, x + 92, y + 73);

  g.fillStyle = "#131211";
  g.font = `900 120px ${sans}`;
  g.fillText(d.amount, x + 36, y + 210, w - 72);
  g.font = `800 30px ${sans}`;
  g.fillText(d.line, x + 40, y + 262, w - 80);

  g.setLineDash([8, 8]);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x + 32, y + 316);
  g.lineTo(x + w - 32, y + 316);
  g.stroke();
  g.setLineDash([]);

  d.rows.forEach(([k, v], i) => {
    const ry = y + 380 + i * 56;
    g.font = `400 26px ${mono}`;
    g.fillStyle = "#6d685f";
    g.textAlign = "left";
    g.fillText(k, x + 40, ry);
    g.fillStyle = "#131211";
    g.font = `600 26px ${mono}`;
    g.textAlign = "right";
    g.fillText(v, x + w - 40, ry);
    g.textAlign = "left";
  });

  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  return blob ? new File([blob], `streetplay-${d.code}.png`, { type: "image/png" }) : null;
}

export function SaveReceiptButton({ data, variant = "ink", label = "Save receipt" }: { data: ReceiptImageData; variant?: "ink"; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={variant}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const file = await receiptPng(data);
          if (!file) return window.print();
          if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: "StreetPlay receipt" }).catch(() => {});
          } else {
            const url = URL.createObjectURL(file);
            const a = document.createElement("a");
            a.href = url;
            a.download = file.name;
            a.click();
            URL.revokeObjectURL(url);
          }
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );
}

export function ShareReceiptButton({ text, url }: { text: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ink"
      onClick={async () => {
        await share({ title: "StreetPlay receipt", text, url });
        if (typeof navigator.share !== "function") {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }
      }}
    >
      {copied ? "Link copied" : "Share receipt ↗"}
    </Button>
  );
}
