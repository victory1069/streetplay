import "server-only";
import type { PaymentsProvider } from "./types";
import { mockProvider } from "./mock";
import { paystackProvider } from "./paystack";

export function getPaymentsProvider(): PaymentsProvider {
  const name = process.env.PAYMENTS_PROVIDER ?? "mock";
  switch (name) {
    case "mock":
      return mockProvider;
    case "paystack":
      return paystackProvider;
    default:
      throw new Error(`Payments provider "${name}" is not implemented`);
  }
}

export * from "./types";
