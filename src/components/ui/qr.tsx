"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Separate module so pages without a QR code don't ship the qrcode library.
/** QR code as inline SVG. */
export function Qr({ value, className = "" }: { value: string; className?: string }) {
  const [svg, setSvg] = useState<string>("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#131211", light: "#ffffff" } }).then((s) => {
      if (alive) setSvg(s);
    });
    return () => {
      alive = false;
    };
  }, [value]);
  return <div className={`[&>svg]:h-full [&>svg]:w-full ${className}`} role="img" aria-label={`QR code for ${value}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
