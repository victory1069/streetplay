import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, clientIp, fail, rateLimit, readJson, tooMany } from "@/lib/server/http";

// "Remind me about Tobi's next Live" / "Add to home screen and we'll ping you".
export async function POST(request: Request) {
  if (!(await rateLimit(`push:${clientIp(request)}`, 10, 600))) return tooMany();
  const body = await readJson<{ handle: string; subscription: { endpoint: string; keys: { p256dh: string; auth: string } } }>(request);
  const sub = body.subscription;
  if (!body.handle || !sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) {
    return badRequest("Invalid subscription.");
  }

  const admin = createAdminClient();
  const { data: creator } = await admin.from("creators").select("id").ilike("instagram_handle", body.handle).maybeSingle();
  if (!creator) return fail(404, "not_found", "We couldn't find that show.");

  await admin
    .from("push_subscriptions")
    .upsert({ endpoint: sub.endpoint, creator_id: creator.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth });
  return Response.json({ ok: true });
}
