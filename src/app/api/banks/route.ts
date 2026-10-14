import { connection } from "next/server";
import { getPaymentsProvider } from "@/lib/payments";

// Public: the participant QR page needs it too. Fetched at request time (not
// build time) and cached by the CDN for a day.
export async function GET() {
  await connection();
  const banks = await getPaymentsProvider().listBanks();
  banks.sort((a, b) => a.name.localeCompare(b.name));
  return Response.json(banks, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
