"use client";

import { useEffect, useState } from "react";

// First-launch intro for the host app (~3s, once per device, tap to skip).
// Visibility is decided before first paint by INTRO_BOOT_SCRIPT (root
// layout), which sets <html data-intro>. CSS in globals.css only shows the
// overlay while that attribute is present, so the page never flashes first.

export const INTRO_KEY = "sp_intro_v1";

/** Runs in <head> before paint: show the intro on host pages for first-time visitors. */
export const INTRO_BOOT_SCRIPT = `try{var p=location.pathname;if((p==="/"||p.indexOf("/studio")===0)&&!localStorage.getItem("${INTRO_KEY}")){document.documentElement.setAttribute("data-intro","")}}catch(e){}`;

const LETTERS = "STREETPLAY".split("");
const COINS = Array.from({ length: 10 }, (_, i) => i);
const WORDS_1 = ["RUN", "THE", "GAME."];
const WORDS_2 = ["PAY", "ON", "CAMERA."];
const DURATION_MS = 3300;

export function IntroSplash() {
  const [on, setOn] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const finish = () => {
    try {
      localStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* private mode: it'll just show again next time */
    }
    setLeaving(true);
    window.setTimeout(() => {
      document.documentElement.removeAttribute("data-intro");
      setOn(false);
    }, 260);
  };

  useEffect(() => {
    if (!document.documentElement.hasAttribute("data-intro")) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = window.setTimeout(() => setOn(true), 0);
    const end = window.setTimeout(() => finish(), reduced ? 900 : DURATION_MS);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(end);
    };
    // Once, on first mount.
  }, []);

  return (
    <div
      className={`sp-intro ${on ? "is-on" : ""} ${leaving ? "is-leaving" : ""}`}
      role="presentation"
      aria-hidden
      onClick={finish}
    >
      {/* Spinning prize wheel behind everything */}
      <svg className="sp-intro-wheel" viewBox="-50 -50 100 100">
        {Array.from({ length: 12 }, (_, i) => {
          const a0 = (i * 30 * Math.PI) / 180;
          const a1 = ((i + 1) * 30 * Math.PI) / 180;
          const fill = i % 4 === 3 ? "#2d5bc6" : i % 2 ? "#1d1b18" : "#fdc52d";
          // Rounded so server and browser render identical markup (no hydration mismatch).
          const p = (v: number) => (Math.round(v * 100) / 100).toFixed(2);
          return <path key={i} d={`M0 0 L${p(48 * Math.sin(a0))} ${p(-48 * Math.cos(a0))} A48 48 0 0 1 ${p(48 * Math.sin(a1))} ${p(-48 * Math.cos(a1))} Z`} fill={fill} />;
        })}
        <circle r="48" fill="none" stroke="#fdc52d" strokeWidth="1.6" />
        <circle r="9" fill="#131211" stroke="#fdc52d" strokeWidth="1.4" />
      </svg>

      <div className="sp-intro-stage">
        {/* Coins burst from behind the ticket */}
        <div className="sp-intro-coins">
          {COINS.map((i) => (
            <span key={i} className="sp-intro-coin" style={{ "--a": `${i * 36 + 12}deg`, "--d": `${120 + (i % 3) * 38}px`, "--t": `${i * 22}ms` } as React.CSSProperties}>
              ₦
            </span>
          ))}
        </div>

        {/* The ticket, drawn as two halves so it can tear along the dashed line */}
        <div className="sp-intro-ticket">
          {(["top", "bottom"] as const).map((half) => (
            <div key={half} className={`sp-intro-half sp-intro-${half}`}>
              <div className="sp-intro-ticket-body">
                <span className="sp-intro-notch sp-intro-notch-l" />
                <span className="sp-intro-notch sp-intro-notch-r" />
                <span className="sp-intro-admit">ADMIT ONE STRANGER</span>
                <span className="sp-intro-word">
                  {LETTERS.map((ch, i) => (
                    <span key={i} className="sp-intro-letter" style={{ "--i": i } as React.CSSProperties}>
                      {ch}
                    </span>
                  ))}
                </span>
                <span className="sp-intro-tear" />
              </div>
            </div>
          ))}
        </div>

        <p className="sp-intro-tagline">
          <span className="sp-intro-line">
            {WORDS_1.map((w, i) => (
              <span key={w} className="sp-intro-slam" style={{ "--w": i } as React.CSSProperties}>
                {w}
              </span>
            ))}
          </span>
          <span className="sp-intro-line sp-intro-line-2">
            {WORDS_2.map((w, i) => (
              <span key={w} className="sp-intro-slam" style={{ "--w": i + 3 } as React.CSSProperties}>
                {w}
              </span>
            ))}
          </span>
        </p>
      </div>

      <span className="sp-intro-skip">Tap to skip</span>
    </div>
  );
}
