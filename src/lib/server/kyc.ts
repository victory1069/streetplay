import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentsProvider } from "@/lib/payments";

/** Once identity is verified, give the creator their own account number. */
export async function activateWallet(admin: SupabaseClient, provider: PaymentsProvider, creatorId: string): Promise<void> {
  const { data: c } = await admin
    .from("creators")
    .select("provider_customer_code, virtual_account_number")
    .eq("id", creatorId)
    .single();
  if (!c?.provider_customer_code || c.virtual_account_number) {
    await admin.from("creators").update({ kyc_status: "verified" }).eq("id", creatorId);
    return;
  }
  const va = await provider.createVirtualAccount(c.provider_customer_code);
  await admin
    .from("creators")
    .update({
      kyc_status: "verified",
      virtual_account_number: va.accountNumber,
      virtual_account_bank: va.bankName,
      virtual_account_name: va.accountName,
    })
    .eq("id", creatorId);
}
