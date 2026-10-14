import { PaymentsError, type PaymentsProvider } from "./types";

// Stand-in that never moves money. Transfers "succeed" instantly, identity
// checks pass, and sponsor checkouts are credited by the API route directly.
// Account numbers starting with 000 fail name enquiry, to test the error path.

const MOCK_NAMES: Record<string, string> = {
  "0123456789": "ADAEZE N. OKORO",
  "0458112212": "CHINEDU P. EZE",
  "8062219034": "SADE MAMA ADEBAYO",
  "0034127781": "TUNDE K. BAKARE",
};

// References "sent" by this server process, so verifyTransfer behaves like a real provider.
const sentRefs = new Set<string>();

export const mockProvider: PaymentsProvider = {
  name: "mock",
  movesRealMoney: false,

  async listBanks() {
    return [
      { code: "044", name: "Access Bank" },
      { code: "058", name: "GTBank" },
      { code: "011", name: "First Bank" },
      { code: "033", name: "UBA" },
      { code: "057", name: "Zenith Bank" },
      { code: "50515", name: "Moniepoint" },
      { code: "999992", name: "OPay" },
      { code: "999991", name: "PalmPay" },
      { code: "50211", name: "Kuda" },
      { code: "035", name: "Wema Bank" },
      { code: "232", name: "Sterling Bank" },
      { code: "070", name: "Fidelity Bank" },
    ];
  },

  async nameEnquiry(accountNumber, bankCode) {
    if (!/^\d{10}$/.test(accountNumber) || accountNumber.startsWith("000")) {
      throw new PaymentsError("Could not resolve account name", false);
    }
    return { accountNumber, bankCode, accountName: MOCK_NAMES[accountNumber] ?? "ADAEZE N. OKORO" };
  },

  async transfer(req) {
    sentRefs.add(req.reference);
    return { status: "sent", providerReference: `MOCK-${req.reference.slice(0, 8).toUpperCase()}` };
  },

  async verifyTransfer(reference) {
    return sentRefs.has(reference) ? { status: "sent", providerReference: `MOCK-${reference.slice(0, 8).toUpperCase()}` } : null;
  },

  async airtime(_phone, _amount, reference) {
    return { status: "sent", providerReference: `MOCK-AIR-${reference.slice(0, 6).toUpperCase()}` };
  },

  async createCustomer(input) {
    return `MOCK_CUS_${input.creatorId.slice(0, 8)}`;
  },

  async verifyIdentity() {
    return "verified";
  },

  async createVirtualAccount(customerCode) {
    const digits = [...customerCode].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1_000_000_000, 7);
    return {
      customerCode,
      accountNumber: `99${String(digits % 100_000_000).padStart(8, "0")}`,
      bankName: "Mock MFB",
      accountName: "STREETPLAY / MOCK",
    };
  },

  async initializeCheckout(req) {
    return { url: `${req.callbackUrl}?mock=1` };
  },

  async parseWebhook() {
    return { type: "ignored" };
  },
};
