"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Arrow, Button, ButtonLink, CheckDot, ErrorText, Headline, Input, Label, PhoneColumn, Select, Spinner, TopBar } from "@/components/ui";
import { useStudioState } from "@/components/studio/studio-context";
import { kycBvn, kycRefresh, kycReturnAccount, kycSubmit } from "@/lib/data/studio";
import { bankName, listBanks, POPULAR_BANK_CODES } from "@/lib/data/payouts";
import { formatPhone, titleCase } from "@/lib/format";
import type { Bank } from "@/lib/payments/types";
import { errorMessage } from "./shared";
import { OnboardingHeader } from "./onboarding";

type StepId = "bvn" | "account" | "selfie";

export function Kyc() {
  const router = useRouter();
  const { ctx, refresh } = useStudioState();
  const [banks, setBanks] = useState<Bank[]>([]);
  // The full BVN lives only in memory: it's needed again at selfie submit, never stored.
  const [bvn, setBvn] = useState("");
  const [bvnInfo, setBvnInfo] = useState<{ first3: string; last4: string; name: string | null } | null>(null);
  const [acct, setAcct] = useState("");
  const [bank, setBank] = useState("");
  const [accountDone, setAccountDone] = useState(false);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<"pending" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listBanks()
      .then(setBanks)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  if (!ctx)
    return (
      <main className="theme-paper flex flex-1 flex-col">
        <Spinner />
      </main>
    );

  const c = ctx.creator;
  const bvnDone = !!bvnInfo || !!c.bvn_last4;
  const acctDone = accountDone || !!c.return_account_number;
  const submitted = result === "pending" || (c.kyc_status === "pending" && !!c.kyc_submitted_at);
  const verified = c.kyc_status === "verified";
  const active: StepId | null = verified || submitted ? null : !bvnDone ? "bvn" : !acctDone ? "account" : "selfie";
  const doneCount = 1 + (bvnDone ? 1 : 0) + (acctDone ? 1 : 0) + (verified || submitted ? 1 : 0);

  const bvnLine = (() => {
    const first3 = bvnInfo?.first3 ?? "•••";
    const last4 = bvnInfo?.last4 ?? c.bvn_last4 ?? "";
    const name = bvnInfo?.name ?? c.bvn_name;
    return `${first3} •••• ${last4}${name ? ` · ${titleCase(name)}` : ""}`;
  })();
  const bankCode = c.return_bank_code ?? bank;
  const last2 = (c.return_account_number ?? acct).slice(-2);
  const acctLine = `${banks.length ? bankName(banks, bankCode) : "Bank"} ••${last2} · unspent money goes here`;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const checkBvn = () =>
    run(async () => {
      if (!/^\d{11}$/.test(bvn)) throw new Error("BVN is 11 digits.");
      setBvnInfo(await kycBvn(bvn));
      void refresh();
    });

  const checkAccount = () =>
    run(async () => {
      if (!/^\d{10}$/.test(acct)) throw new Error("Account number must be 10 digits.");
      if (!bank) throw new Error("Pick your bank.");
      await kycReturnAccount(acct, bank);
      setAccountDone(true);
      void refresh();
    });

  const submitSelfie = () =>
    run(async () => {
      if (!selfie) return fileRef.current?.click();
      if (!/^\d{11}$/.test(bvn)) throw new Error("Type your BVN again to finish. We don't keep it.");
      const status = await kycSubmit(bvn, selfie);
      setBvn("");
      await refresh();
      if (status === "verified") router.push("/studio/wallet/fund?setup=1");
      else setResult("pending");
    });

  const recheck = () =>
    run(async () => {
      const { kyc_status } = await kycRefresh();
      await refresh();
      if (kyc_status === "verified") router.push("/studio/wallet/fund?setup=1");
      else if (kyc_status === "rejected") setResult(null);
    });

  const bottom: ReactNode = verified ? (
    <ButtonLink href="/studio/wallet/fund">
      FUND WALLET <Arrow />
    </ButtonLink>
  ) : submitted ? (
    <Button onClick={recheck} loading={busy}>
      CHECK AGAIN
    </Button>
  ) : active === "bvn" ? (
    <Button onClick={checkBvn} loading={busy} disabled={bvn.length !== 11}>
      CHECK BVN <Arrow />
    </Button>
  ) : active === "account" ? (
    <Button onClick={checkAccount} loading={busy} disabled={acct.length !== 10 || !bank}>
      CHECK ACCOUNT <Arrow />
    </Button>
  ) : (
    <Button onClick={submitSelfie} loading={busy}>
      {selfie ? "SEND SELFIE" : "TAKE SELFIE"}
    </Button>
  );

  const popular = POPULAR_BANK_CODES.map((code) => banks.find((b) => b.code === code)).filter((b): b is Bank => !!b);

  return (
    <main className="theme-paper flex flex-1 flex-col">
      <PhoneColumn>
        {verified ? (
          <TopBar back="/studio" title="Your wallet" />
        ) : (
          <OnboardingHeader step={2} title="Open wallet" back="/studio" />
        )}
        <div className="flex flex-1 flex-col px-7 pt-6 pb-[calc(env(safe-area-inset-bottom)+24px)]">
          {!verified && (
            <p className="mb-3 font-mono text-[14px]">
              {Math.min(4, doneCount)} of 4 checks done
            </p>
          )}
          <Headline className="text-[clamp(48px,14vw,64px)] leading-[0.86]">
            {verified ? "Your wallet is open." : "Before money moves, we check it's you."}
          </Headline>

          <div className="mt-6 space-y-3">
            <DoneCard title="Phone number" sub={formatPhone(ctx.phone ?? c.phone)} />

            {bvnDone ? (
              <DoneCard title="BVN" sub={bvnLine} />
            ) : active === "bvn" ? (
              <ActiveCard n={2} title="BVN" sub="11 digits · dial *565*0# to get it">
                <Input
                  tone="dark"
                  mono
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={11}
                  value={bvn}
                  onChange={(e) => setBvn(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="22212345678"
                  aria-label="BVN"
                />
              </ActiveCard>
            ) : (
              <TodoCard n={2} title="BVN" />
            )}

            {acctDone ? (
              <DoneCard title="Return account" sub={acctLine} />
            ) : active === "account" ? (
              <ActiveCard n={3} title="Return account" sub="Unspent money goes here">
                <div className="space-y-3">
                  <Input
                    tone="dark"
                    mono
                    inputMode="numeric"
                    maxLength={10}
                    value={acct}
                    onChange={(e) => setAcct(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="0123456789"
                    aria-label="Account number"
                  />
                  <Select value={bank} onChange={(e) => setBank(e.target.value)} aria-label="Bank" className="bg-paper">
                    <option value="">Pick your bank</option>
                    {popular.length > 0 && (
                      <optgroup label="Popular">
                        {popular.map((b) => (
                          <option key={`p-${b.code}`} value={b.code}>
                            {b.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="All banks">
                      {banks.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name}
                        </option>
                      ))}
                    </optgroup>
                  </Select>
                </div>
              </ActiveCard>
            ) : (
              <TodoCard n={3} title="Return account" />
            )}

            {verified ? (
              <DoneCard title="Selfie check" sub="Verified" />
            ) : submitted ? (
              <div className="flex items-center gap-5 rounded-[14px] border-[3px] border-ink bg-card px-6 py-5" aria-live="polite">
                <CheckDot tone="pending" />
                <div>
                  <p className="font-wide text-[20px] leading-tight">Selfie check</p>
                  <p className="mt-1 font-mono text-[15px] opacity-70">We&apos;re checking. Usually under 10 minutes.</p>
                </div>
              </div>
            ) : active === "selfie" ? (
              <div className="rounded-[14px] bg-ink text-paper">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center gap-5 px-6 py-5 text-left"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-yellow font-mono text-[18px] text-yellow">4</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-wide block text-[20px] leading-tight">Selfie check</span>
                    <span className="mt-1 block font-mono text-[15px] opacity-80">{selfie ? "Looking good · tap to retake" : "Takes 20 seconds"}</span>
                  </span>
                  <span className="text-[30px] text-yellow" aria-hidden>
                    →
                  </span>
                </button>
                {(preview || !bvnInfo) && (
                  <div className="space-y-4 px-6 pb-6">
                    {preview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt="Your selfie" className="mx-auto aspect-square w-40 rounded-full border-[3px] border-yellow object-cover" />
                    )}
                    {!bvnInfo && (
                      <label className="block">
                        <Label className="mb-2 text-yellow">Type your BVN again · we don&apos;t keep it</Label>
                        <Input
                          tone="dark"
                          mono
                          inputMode="numeric"
                          maxLength={11}
                          value={bvn}
                          onChange={(e) => setBvn(e.target.value.replace(/\D/g, "").slice(0, 11))}
                          aria-label="BVN"
                        />
                      </label>
                    )}
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="sr-only"
                  aria-label="Selfie"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setSelfie(f);
                    setPreview(URL.createObjectURL(f));
                    e.target.value = "";
                  }}
                />
              </div>
            ) : (
              <TodoCard n={4} title="Selfie check" />
            )}
          </div>

          {c.kyc_status === "rejected" && !submitted && (
            <p className="mt-4 text-[16px] font-semibold text-red">We couldn&apos;t verify that selfie. Take a new one in good light.</p>
          )}

          <div className="mt-auto space-y-5 pt-8">
            <p className="text-[17px] leading-[1.5] opacity-80">
              Our licensed payments partner holds your wallet and runs these checks. StreetPlay never holds your money. Approval usually takes under 10
              minutes.
            </p>
            <ErrorText>{error}</ErrorText>
            {bottom}
          </div>
        </div>
      </PhoneColumn>
    </main>
  );
}

function DoneCard({ title, sub }: { title: string; sub: ReactNode }) {
  return (
    <div className="flex items-center gap-5 rounded-[14px] border-[3px] border-ink bg-card px-6 py-5">
      <CheckDot />
      <div className="min-w-0">
        <p className="font-wide text-[20px] leading-tight">{title}</p>
        <p className="mt-1 font-mono text-[15px] leading-snug opacity-70">{sub}</p>
      </div>
    </div>
  );
}

function ActiveCard({ n, title, sub, children }: { n: number; title: string; sub: string; children: ReactNode }) {
  return (
    <div className="space-y-4 rounded-[14px] bg-ink px-6 py-5 text-paper">
      <div className="flex items-center gap-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-yellow font-mono text-[18px] text-yellow">{n}</span>
        <div>
          <p className="font-wide text-[20px] leading-tight">{title}</p>
          <p className="mt-1 font-mono text-[15px] opacity-80">{sub}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function TodoCard({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-5 rounded-[14px] border-[3px] border-ink/30 px-6 py-5 opacity-60">
      <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-muted font-mono text-[18px]">{n}</span>
      <p className="font-wide text-[20px] leading-tight">{title}</p>
    </div>
  );
}
