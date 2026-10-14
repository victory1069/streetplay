import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// "We'll ping you when @tobi.streets starts a game." Needs VAPID keys:
//   npx web-push generate-vapid-keys
// Without them push is silently skipped.

let configured: boolean | null = null;

function configure(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  configured = Boolean(pub && priv);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:hello@streetplay.ng", pub!, priv!);
  return configured;
}

export async function notifyFans(creatorId: string, payload: { title: string; body: string; url: string }): Promise<number> {
  if (!configure()) return 0;
  const admin = createAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("*").eq("creator_id", creatorId);
  let sent = 0;

  await Promise.all(
    (subs ?? []).map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
          TTL: 60 * 30,
        });
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }),
  );
  return sent;
}
