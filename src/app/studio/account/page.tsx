import type { Metadata } from "next";
import { Account } from "@/components/studio-setup/account";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return <Account />;
}
