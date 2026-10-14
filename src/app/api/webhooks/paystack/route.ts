import { createAdminClient } from "@/lib/supabase/admin";
import { paystackProvider } from "@/lib/payments/paystack";
import { notifyPayoutSent } from "@/lib/payouts/server";
import { activateWallet } from "@/lib/server/kyc";
import type { Payout } from "@/types/domain";

// Paystack calls this for transfers into creators' account numbers, sponsor
// checkouts, transfer outcomes and identity checks. Every write is idempotent
// (unique references, forward-only statuses), so Paystack's retries are
// harmless. Answer 200 quickly or Paystack keeps retrying.
export async function POST(request: Request) {
  const raw = await request.text();

  let event;
  try {
    event = await paystackProvider.parseWebhook(raw, request.headers);
  } catch {
    return new Response("invalid signature", { status: 401 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "funding": {
      const { data: creator } = await admin
        .from("creators")
        .select("id, default_episode_id")
        .eq("provider_customer_code", event.customerCode)
        .maybeSingle();
      if (!creator) break;
      const { error } = await admin.rpc("record_funding", {
        p_creator: creator.id,
        p_amount: event.amount,
        p_reference: event.reference,
        p_kind: "topup",
        p_episode: creator.default_episode_id,
        p_counterparty: event.sender,
      });
      if (error) return new Response(error.message, { status: 500 });
      break;
    }

    case "sponsor": {
      const { error } = await admin.rpc("record_funding", {
        p_creator: event.creatorId,
        p_amount: event.amount,
        p_reference: event.reference,
        p_kind: "sponsor",
        p_episode: event.episodeId,
        p_counterparty: event.sponsorName,
      });
      if (error) return new Response(error.message, { status: 500 });
      await admin.from("episodes").update({ sponsor_name: event.sponsorName }).eq("id", event.episodeId).is("sponsor_name", null);
      break;
    }

    case "transfer.result": {
      // Payout references are the payout id; withdrawals are "wd_<id>".
      if (event.reference.startsWith("wd_")) {
        await admin.rpc("mark_withdrawal_result", {
          p_id: event.reference.slice(3),
          p_status: event.status === "reversed" ? "failed" : event.status,
          p_provider_reference: null,
          p_failure_reason: event.reason ?? null,
        });
        break;
      }
      if (!/^[0-9a-f-]{36}$/.test(event.reference)) break; // not ours
      const { data, error } = await admin.rpc("mark_payout_result", {
        p_payout: event.reference,
        p_status: event.status,
        p_provider_reference: null,
        p_failure_reason: event.reason ?? null,
      });
      if (error && error.message !== "payout_not_found") return new Response(error.message, { status: 500 });
      const payout = data as Payout | null;
      if (payout?.status === "sent" && event.status === "sent") await notifyPayoutSent(admin, paystackProvider, payout);
      break;
    }

    case "identity.result": {
      const { data: creator } = await admin.from("creators").select("id").eq("provider_customer_code", event.customerCode).maybeSingle();
      if (!creator) break;
      if (event.verified) await activateWallet(admin, paystackProvider, creator.id);
      else await admin.from("creators").update({ kyc_status: "rejected" }).eq("id", creator.id);
      break;
    }
  }

  return new Response("ok");
}
