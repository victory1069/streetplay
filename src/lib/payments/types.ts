import type { Kobo } from "@/types/domain";

// A licensed partner holds funds and moves money; we keep the ledger. Every
// partner sits behind this interface so a second one can be added later.

export interface Bank {
  code: string;
  name: string;
}

export interface NameEnquiryResult {
  accountNumber: string;
  bankCode: string;
  accountName: string;
}

export interface TransferRequest {
  /** Our id. Providers reject a reused reference, so retries can't double-pay. */
  reference: string;
  amount: Kobo;
  accountNumber: string;
  bankCode: string;
  accountName: string;
  narration: string;
}

export type TransferStatus = "sent" | "pending" | "failed";

export interface TransferResult {
  status: TransferStatus;
  providerReference?: string;
  failureReason?: string;
}

export interface CustomerInput {
  creatorId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export interface VirtualAccount {
  customerCode: string;
  accountNumber: string;
  bankName: string;
  accountName: string;
}

export interface IdentityRequest {
  customerCode: string;
  bvn: string;
  accountNumber: string;
  bankCode: string;
  firstName: string;
  lastName: string;
}

export interface CheckoutRequest {
  reference: string;
  amount: Kobo;
  email: string;
  callbackUrl: string;
  metadata: { kind: "sponsor"; creator_id: string; episode_id: string; sponsor_name: string };
}

/** Normalised webhook event. */
export type PaymentEvent =
  | { type: "funding"; reference: string; customerCode: string; amount: Kobo; sender: string | null }
  | { type: "sponsor"; reference: string; creatorId: string; episodeId: string; sponsorName: string; amount: Kobo }
  | { type: "transfer.result"; reference: string; status: "sent" | "failed" | "reversed"; reason?: string }
  | { type: "identity.result"; customerCode: string; verified: boolean; reason?: string }
  | { type: "ignored" };

export interface PaymentsProvider {
  readonly name: string;
  /** False for the mock: skips KYC checks so you can test end to end. */
  readonly movesRealMoney: boolean;
  listBanks(): Promise<Bank[]>;
  nameEnquiry(accountNumber: string, bankCode: string): Promise<NameEnquiryResult>;
  transfer(req: TransferRequest): Promise<TransferResult>;
  /** Look up a transfer we may have sent before a timeout. Null = never sent. */
  verifyTransfer(reference: string): Promise<TransferResult | null>;
  /** Airtime top-up for viewer prizes. Undefined when the provider can't. */
  airtime?(phone: string, amount: Kobo, reference: string): Promise<TransferResult>;
  createCustomer(input: CustomerInput): Promise<string>;
  /** Starts identity checks. "pending" resolves later via an identity.result webhook. */
  verifyIdentity(req: IdentityRequest): Promise<"verified" | "pending">;
  /** A dedicated account number creators (or anyone) transfer into. */
  createVirtualAccount(customerCode: string): Promise<VirtualAccount>;
  /** Hosted checkout for sponsors paying by card or transfer. */
  initializeCheckout(req: CheckoutRequest): Promise<{ url: string }>;
  parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent>;
}

/** Error from the provider. `retryable` means the outcome is unknown, not failed. */
export class PaymentsError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
