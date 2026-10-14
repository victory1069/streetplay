"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Arrow, Button, CodeBoxes, ErrorText, Headline, Label, Logo, Ticket } from "@/components/ui";
import { formatNaira } from "@/lib/money";
import { maskAccount } from "@/lib/format";
import { FORMATS } from "@/lib/games/formats";
import type { ClaimView } from "@/lib/server/views";
import { api, bankName, useBanks } from "./api";
import { BankFields, NameTicket } from "./bank-fields";

// /claim: bankless street winners got a 6-digit code by SMS. They type it,
// add any account or wallet, see the bank's name, and claim.

function leftLabel(expiresAt: string | null, now: number): string {
  if (!expiresAt) return "";
  const hours = (new Date(expiresAt).getTime() - now) / 3_600_000;
  if (hours <= 0) return "";
  if (hours < 24) return ` · ${Math.max(1, Math.floor(hours))} ${Math.floor(hours) === 1 ? "HOUR" : "HOURS"} LEFT`;
  const days = Math.floor(hours / 24);
  return ` · ${days} ${days === 1 ? "DAY" : "DAYS"} LEFT`;
}

export function ClaimForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const banks = useBanks();
  const [code, setCode] = useState(initialCode.replace(/\D/g, "").slice(0, 6));
  const [lookup, setLookup] = useState<{ code: string; view: (ClaimView & { left: string }) | null; error: string | null } | null>(null);
  const [account, setAccount] = useState("");
  const [bank, setBank] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "check" | "claim">(null);
  const [error, setError] = useState<string | null>(null);

  // Look the code up once all six digits are in.
  useEffect(() => {
    if (code.length !== 6) return;
    let alive = true;
    api<ClaimView>(`/api/claim/${code}`)
      .then((v) => {
        if (alive) setLookup({ code, view: { ...v, left: leftLabel(v.expires_at, Date.now()) }, error: null });
      })
      .catch((e: Error) => {
        if (alive) setLookup({ code, view: null, error: e.message });
      });
    return () => {
      alive = false;
    };
  }, [code]);

  const current = code.length === 6 && lookup?.code === code ? lookup : null;
  const view = current?.view ?? null;
  const codeError = current?.error ?? null;
  const checking = code.length === 6 && !current;

  function onCode(v: string) {
    setCode(v);
    setName(null);
    setError(null);
  }

  async function check() {
    setBusy("check");
    setError(null);
    try {
      const r = await api<{ accountName: string }>(`/api/claim/${code}`, { check: true, accountNumber: account, bankCode: bank });
      setName(r.accountName);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function claim() {
    setBusy("claim");
    setError(null);
    try {
      const p = await api<{ receipt_code: string }>(`/api/claim/${code}`, { channel: "bank", accountNumber: account, bankCode: bank });
      router.push(`/r/${p.receipt_code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  const held = view?.status === "held";
  const format = view?.round_format ? FORMATS[view.round_format]?.name : null;
  const from = view
    ? ["From " + (view.creator_handle ? `@${view.creator_handle}` : view.creator_name), `Ep ${view.episode_number}`, format].filter(Boolean).join(" · ")
    : "";

  return (
    <main className="theme-paper flex flex-1 flex-col">
      <form
        className="mx-auto flex w-full max-w-[460px] flex-1 flex-col px-5 pt-6 pb-6 lg:max-w-[800px] lg:pt-14"
        onSubmit={(e) => {
          e.preventDefault();
          if (!held || account.length !== 10 || !bank) return;
          if (name) void claim();
          else void check();
        }}
      >
        <Logo className="mb-6 hidden self-start lg:inline-flex" />
        <Headline className="text-[clamp(56px,17vw,80px)] lg:text-[112px]">CLAIM YOUR PRIZE</Headline>

        <Label className="mt-6 mb-2.5">
          Claim code<span className="hidden lg:inline"> from your SMS</span>
        </Label>
        <CodeBoxes value={code} onChange={onCode} />
        {checking && <p className="font-label sp-pulse mt-3">Checking code…</p>}
        {codeError && (
          <div className="mt-3">
            <ErrorText>{codeError}</ErrorText>
          </div>
        )}

        {view && (
          <Ticket tone="ink" className="mt-6" bodyClassName="flex items-center justify-between gap-4 px-6 py-5 lg:px-8">
            <div className="min-w-0">
              {held ? (
                <p className="font-mono text-[14px] font-semibold text-green uppercase">✓ Code OK{view.left}</p>
              ) : (
                <p className="font-mono text-[14px] font-semibold text-red uppercase">
                  {view.status === "expired" ? "Code expired" : "Already claimed"}
                </p>
              )}
              <p className="mt-0.5 text-[17px] leading-tight text-paper/80">{from}</p>
            </div>
            <p className="font-display tabular shrink-0 text-[clamp(40px,12vw,52px)] text-yellow lg:text-[80px]">{formatNaira(view.amount)}</p>
          </Ticket>
        )}

        {view && view.status === "expired" && (
          <p className="mt-5 text-[18px] leading-snug">This claim code has expired. The money went back to the host. Ask them about it.</p>
        )}
        {view && !held && view.status !== "expired" && (
          <Link href={`/r/${view.receipt_code}`} className="mt-5 font-wide text-[19px] underline underline-offset-4">
            See the receipt →
          </Link>
        )}

        {held && (
          <div className="mt-6 flex flex-col gap-5">
            <BankFields
              row
              banks={banks}
              bankLabel="Bank or wallet"
              account={account}
              onAccount={(v) => {
                setAccount(v);
                setName(null);
              }}
              bank={bank}
              onBank={(v) => {
                setBank(v);
                setName(null);
              }}
            />
            {name && (
              <NameTicket
                name={name}
                stub={
                  <div className="flex justify-between font-mono text-[16px]">
                    <span>
                      {bankName(banks, bank)} · {maskAccount(account)}
                    </span>
                    <span className="text-yellow">{formatNaira(view.amount)}</span>
                  </div>
                }
              />
            )}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-3 pt-8">
          <ErrorText>{error}</ErrorText>
          {held &&
            (name ? (
              <Button type="submit" loading={busy === "claim"}>
                CLAIM {formatNaira(view.amount)}
              </Button>
            ) : (
              <Button type="submit" loading={busy === "check"} disabled={account.length !== 10 || !bank}>
                CHECK MY NAME <Arrow />
              </Button>
            ))}
        </div>
      </form>
    </main>
  );
}
