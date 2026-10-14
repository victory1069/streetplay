import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, fail, rateLimit, readJson, tooMany } from "@/lib/server/http";
import { participantView } from "@/lib/server/views";

// Step 2: "Yes, that's me" (or "No, change details"). Confirming puts the
// name on the host's screen through Realtime.
export async function POST(request: Request, { params }: RouteContext<"/api/p/[code]/confirm">) {
  const { code } = await params;
  if (!(await rateLimit(`p:confirm:${clientIp(request)}`, 20, 300))) return tooMany();
  const { confirm } = await readJson<{ confirm: boolean }>(request);

  const admin = createAdminClient();
  const { data } = await admin
    .from("account_requests")
    .update(confirm === false ? { status: "waiting", account_number: null, bank_code: null, account_name: null } : { status: "confirmed" })
    .eq("code", code.toUpperCase())
    .eq("status", "named")
    .select("code")
    .maybeSingle();
  if (!data) return fail(409, "not_named", "Enter your account details first.");
  return Response.json(await participantView(admin, code));
}
