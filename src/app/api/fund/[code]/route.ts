import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentsProvider } from "@/lib/payments";
import { badRequest, clientIp, dbError, fail, rateLimit, readJson, tooMany } from "@/lib/server/http";
import { appUrl } from "@/lib/format";

// Sponsor funding link (/fund/[code]), tagged to one episode. Sponsors pay by
// card or transfer on the partner's checkout; the webhook credits the wallet.
export async function POST(request: Request, { params }: RouteContext<"/api/fund/[code]">) {
  const { code } = await params;
  if (!(await rateLimit(`fund:${clientIp(request)}`, 10, 600))) return tooMany();

  const body = await readJson<{ amount: number; email: string; sponsorName: string }>(request);
  if (!Number.isInteger(body.amount) || body.amount! < 1_000_00) return badRequest("Minimum is ₦1,000.");
  if (!/^\S+@\S+\.\S+$/.test(body.email ?? "")) return badRequest("Enter an email for the receipt.");
  const sponsorName = body.sponsorName?.trim().slice(0, 60);
  if (!sponsorName) return badRequest("Enter the brand name.");

  const admin = createAdminClient();
  const { data: ep } = await admin.from("episodes").select("id, creator_id, status, sponsor_name").eq("public_code", code.toUpperCase()).maybeSingle();
  if (!ep) return fail(404, "not_found", "This funding link doesn't exist.");
  if (ep.status === "wrapped") return fail(410, "wrapped", "This episode has already wrapped.");

  const provider = getPaymentsProvider();
  const reference = `sp_${crypto.randomUUID()}`;
  const callbackUrl = appUrl(`/fund/${code.toUpperCase()}/done`);

  if (!provider.movesRealMoney) {
    const { error } = await admin.rpc("record_funding", {
      p_creator: ep.creator_id, p_amount: body.amount, p_reference: reference, p_kind: "sponsor",
      p_episode: ep.id, p_counterparty: sponsorName,
    });
    if (error) return dbError(error);
    if (!ep.sponsor_name) await admin.from("episodes").update({ sponsor_name: sponsorName }).eq("id", ep.id);
  }

  const { url } = await provider.initializeCheckout({
    reference,
    amount: body.amount!,
    email: body.email!,
    callbackUrl,
    metadata: { kind: "sponsor", creator_id: ep.creator_id, episode_id: ep.id, sponsor_name: sponsorName },
  });
  return Response.json({ url });
}
