import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentsProvider, PaymentsError } from "@/lib/payments";
import { badRequest, clientIp, fail, rateLimit, readJson, tooMany } from "@/lib/server/http";
import { participantView } from "@/lib/server/views";
import { normalizePhone } from "@/lib/format";

// Participant QR page (/p/[code]). No login: the short-lived code is the
// permission, and the host reads the resolved name out on camera before
// sending, so a wrong account can't slip through.

export async function GET(request: Request, { params }: RouteContext<"/api/p/[code]">) {
  await connection();
  const { code } = await params;
  if (!(await rateLimit(`p:get:${clientIp(request)}`, 120, 60))) return tooMany();
  const view = await participantView(createAdminClient(), code);
  return view ? Response.json(view) : fail(404, "not_found", "This link doesn't exist. Ask the host for a new one.");
}

/** Step 1: account number + bank → the name the bank has. */
export async function POST(request: Request, { params }: RouteContext<"/api/p/[code]">) {
  const { code } = await params;
  if (!(await rateLimit(`p:post:${clientIp(request)}:${code}`, 10, 300))) return tooMany();

  const body = await readJson<{ accountNumber: string; bankCode: string; phone: string }>(request);
  if (!/^\d{10}$/.test(body.accountNumber ?? "")) return badRequest("Account number must be 10 digits.");
  if (!body.bankCode) return badRequest("Pick your bank.");
  const phone = body.phone ? normalizePhone(body.phone) : null;

  const admin = createAdminClient();
  const { data: req } = await admin.from("account_requests").select("token, status, expires_at").eq("code", code.toUpperCase()).maybeSingle();
  if (!req) return fail(404, "not_found", "This link doesn't exist. Ask the host for a new one.");
  if (!["waiting", "named"].includes(req.status) || new Date(req.expires_at) < new Date()) {
    return fail(410, "expired", "This link has expired or was already used. Ask the host for a new one.");
  }

  let accountName: string;
  try {
    accountName = (await getPaymentsProvider().nameEnquiry(body.accountNumber!, body.bankCode)).accountName;
  } catch (err) {
    const retryable = err instanceof PaymentsError && err.retryable;
    return fail(retryable ? 503 : 422, "name_enquiry_failed", retryable ? "Bank lookup is down. Try again." : "We couldn't find that account. Check the number and bank.");
  }

  await admin
    .from("account_requests")
    .update({
      account_number: body.accountNumber,
      bank_code: body.bankCode,
      account_name: accountName,
      phone,
      status: "named",
      submitted_at: new Date().toISOString(),
    })
    .eq("token", req.token);

  return Response.json(await participantView(admin, code));
}
