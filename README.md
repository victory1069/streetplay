# StreetPlay

Phone-first toolkit for street-game creators: run the game, pay the winner on camera, and let the Instagram Live audience play along. A Next.js 16 PWA with Supabase as the whole backend.

```bash
npm install
cp .env.example .env.local   # fill in the Supabase keys (see Setup)
npm run dev                  # http://localhost:3000
npm run build && npm start   # service worker + push only work in production
```

Other scripts: `npm run typecheck`, `npm run lint`, `npm run icons` (regenerates PNGs from `public/icons/icon.svg`).

## Local mode (no Supabase needed)

Set `NEXT_PUBLIC_DEMO_MODE=1` (and optionally `DEMO_OTP`) in `.env.local` and run `npm run dev`. The app then runs the real migrations in a local Postgres (PGlite) saved in `.demo-data/`, seeded from `supabase/seed/demo.sql`. Everything else is the normal app: sign in on the landing page with a phone number and the one-time code.

| Account | Phone | Code |
|---|---|---|
| Demo creator: Tobi (host). Ep 10–11 wrapped, Ep 12 Yaba Market live, ₦612,500 wallet | 0803 555 0142 | 123456 |
| Any other Nigerian number: a brand-new account through onboarding, KYC and funding | yours | 123456 |

Public links from the seed: viewer game `/play/tobi.streets`, receipt `/r/7Q4K2R`, participant QR page `/p/K7Q2AB`, claim `/claim` with code 482913, viewer prize `/win/TUNDE9M2`.

Money is pretend (mock payments and SMS). `npm run demo:reset` wipes the local database; it re-seeds on the next start. Remove `NEXT_PUBLIC_DEMO_MODE` to use a real Supabase project.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com) (pick the region closest to Lagos that's offered).
2. **SQL Editor**: run both files in `supabase/migrations/` in order (`…_init.sql`, then `…_screens.sql`).
3. **Project Settings → API Keys**: copy the URL, publishable key and secret key into `.env.local`.
4. **Authentication → Providers → Phone**: enable it and connect an SMS provider (Twilio, Vonage, MessageBird, Textlocal, or the Send SMS hook for Termii). While developing, add **test phone numbers** with fixed codes on the same page, so you can sign in without sending real SMS.
5. **Authentication → URL Configuration**: set the Site URL to your domain.

`NEXT_PUBLIC_*` values are baked into the browser bundle at build time: set them before `npm run build`.

### 2. Payments, SMS, push

Everything defaults to safe mocks, so the whole flow works locally with no accounts:

| Setting | Mock behaviour | Real |
|---|---|---|
| `PAYMENTS_PROVIDER=mock` | Transfers succeed instantly, KYC passes, each creator gets a fake account number; the Fund screen has a "simulate a transfer" link | `paystack` |
| `SMS_PROVIDER=mock` | Messages are written to the `sms_log` table and the server console | `termii` |
| no VAPID keys | Push is skipped | `npx web-push generate-vapid-keys` |

Going live with Paystack:
1. Registered business with **Transfers** and **Dedicated Virtual Accounts** enabled.
2. **Settings → Preferences**: turn off OTP for transfers.
3. **Settings → API Keys & Webhooks**: webhook `https://<your-domain>/api/webhooks/paystack`.
4. `.env.local`: `PAYMENTS_PROVIDER=paystack`, `PAYSTACK_SECRET_KEY=sk_live_…`.

Paystack has no airtime API, so viewer airtime prizes show "Coming soon" until a VTU provider is added (`airtime()` in `src/lib/payments`).

### 3. Deploy

Push to GitHub, import into Vercel, add the same env vars.

## The app

### Onboarding

Defined in `src/lib/onboarding.ts`. Phone → code → Step 1 Your show → Step 2 Open your wallet → Step 3 Fund your wallet (skippable) → Home with a "Finish setting up" checklist until the first episode exists. Anyone who leaves midway resumes at their step.

### Host app (installed PWA, `/studio`)

There are no crew accounts: one phone number runs the whole show. Big payouts are guarded by **hold to send** instead of a second person's approval. When the amount is above the episode's "Hold to send above" limit (or the creator default under Account), or the account has won on the show before, the name screen shows "This is a big one" and the host presses and holds SEND for 1.5 seconds. Repeat winners are refused outright when the episode's repeat setting is Block or Account → Repeat winners is Block.

| Screen | Route |
|---|---|
| Landing + phone sign-in | `/` |
| Step 1 · Your show | `/studio/welcome` |
| Step 2 · Open your wallet (KYC: phone, BVN, return account, selfie) | `/studio/kyc` |
| Home | `/studio` |
| Episodes | `/studio/episodes` |
| New episode wizard (name/formats → budget → content) | `/studio/episodes/new` |
| Episode console ("Next round") | `/studio/episodes/[id]` |
| Round: consent → rules → game → result | `/studio/episodes/[id]/rounds/[roundId]` |
| Pay the winner: QR / keypad → name → send (hold to send when big) → "E DON LAND!" / bankless | `/studio/episodes/[id]/rounds/[roundId]/payout` |
| Offline queue | `/studio/episodes/[id]/queued` |
| Live control: votes, reveals, viewer prizes, waiting note (from the console's ⋯ menu) | `/studio/episodes/[id]/live` |
| Episode log, export, printable PDF | `/studio/episodes/[id]/log`, `/log/export`, `/log/print` |
| Close episode ("NA WRAP!") | `/studio/episodes/[id]/wrap` |
| Wallet, fund, funded | `/studio/wallet`, `/studio/wallet/fund`, `/studio/wallet/funded` |
| Account: show, viewer link, limits, plan, sign out | `/studio/account` |
| Write your own questions | `/studio/packs` |

### Participants, viewers, the public (no install, responsive)

| Screen | Route |
|---|---|
| Participant enters their own account (QR) | `/p/[code]` |
| Receipt (sent / locked in) | `/r/[code]` |
| Delete my details | `/r/[code]/delete` |
| All receipts for an episode (caption verify link) | `/e/[code]` |
| Fair-play check | `/verify/[roundId]` |
| Bankless claim with SMS code | `/claim` |
| Viewer game (join, waiting, vote, predict, quiz, name the song, result) | `/play/[handle]` |
| Leaderboard (this Live / month / all time) | `/play/[handle]/board` |
| Viewer prize claim | `/win/[code]`, `/win/[code]/bank`, `/win/[code]/airtime` |
| Sponsor funding link | `/fund/[code]` |

## How it fits together

```
Host PWA ───┐                          ┌── Postgres: tables, RLS, money + scoring functions
Viewer page ┼── Next.js API routes ────┼── Auth: phone OTP
Public pages┘   (Vercel)               ├── Realtime: prompts, payouts, episode state
                                       ├── Payments partner: name enquiry, transfers, virtual accounts, KYC
                                       └── SMS: receipts, claim codes
```

- **Money never moves from the browser.** Payouts, claims, withdrawals and top-ups go through API routes that call Postgres functions (`create_payout`, `claim_payout`, `mark_payout_result`, `create_withdrawal`, `record_funding`). They lock the creator's wallet, check every limit (max per payout, episode budget, day limit, round cap, one payout per round, repeat winners) and reserve amount + fee in one transaction.
- **The wallet is a ledger.** Balance = sum of `wallet_entries`. Each payout debits amount and fee when it's created and refunds both exactly once if it fails, is rejected or expires.
- **The server checks every name itself.** The client's account name is never trusted, and public receipts show only "Adaeze O.".
- **Offline first.** Rounds, consents and clip markers are written to IndexedDB and synced in order (`src/lib/offline/sync.ts`); payouts queue in the outbox with idempotency keys (`src/lib/offline/outbox.ts`). A retry after a dropped connection never pays twice, and if a transfer timed out, the server asks the provider before sending again.
- **Fairness.** Each round commits `sha256(seed)` before play; wheel slices and box amounts come only from the seed (`src/lib/games/engines.ts`). The database rejects a seed that doesn't match its commitment; `/verify` re-hashes in the browser and replays the outcome.
- **Viewers don't sign up.** An httpOnly cookie per creator identifies a fan, so points add up across that creator's Lives. Quiz and song answers are judged on the server against answers viewers can't read; predictions score at the reveal.
- **Abuse limits.** Public endpoints are rate limited in Postgres (`hit_rate_limit`).

## Code map

```
src/app/                  routes (above) and api/
src/components/ui/        design system: Ticket, Button, fields, chips, keypad, hold button, QR…
src/components/studio-setup/ landing, sign-in, onboarding, KYC, home, wallet, new-episode wizard, account
src/components/games/     console, round flow, the six formats
src/components/payout/    pay the winner, hold to send, offline queue
src/components/producer/  Live control
src/components/episode-after/ log, export, print, wrap
src/components/public/    receipts, delete, episode receipts, verify, sponsor funding
src/components/participant/ QR account page, claim
src/components/viewer/    viewer game, board, prize claim
src/lib/data/             client data helpers (what screens call)
src/lib/server/           server-only: SMS, push, rate limits, read models, KYC
src/lib/payments/         provider interface, mock, Paystack
src/lib/games/            formats, budget plan, engines, fairness, scoring
src/content/              starter question and song packs
supabase/migrations/      schema, RLS, money and scoring functions
```

## Before launch

- **Holding funds:** money sent to creators' account numbers sits in StreetPlay's Paystack balance. That may count as holding customer funds under CBN rules. Get legal advice, or use a partner with per-customer wallets.
- **Content:** have a Nigerian editor check the question packs (`src/content/question-packs.ts`) and the song cue times.
- **Phone auth:** connect a real SMS provider in Supabase; keep test numbers out of production.
- **KYC:** the Paystack identity check is wired up, but read their compliance terms for your business type. Selfies sit in the private `kyc` storage bucket for audit.
- **Generated DB types:** `npx supabase gen types typescript --project-id <ref> > src/types/supabase.ts` can replace the hand-written row types in `src/types/domain.ts`.
- **Not built:** airtime provider, sponsor dashboard and report (V3), OBS overlay (V2), comment-keyword voting.
