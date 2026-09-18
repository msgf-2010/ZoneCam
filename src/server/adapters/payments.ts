import { getEnv } from "@/lib/env";

export type PaymentRequestInput = {
  amountCents: number;
  currency: string;
  description: string;
};

export type PaymentResult = {
  provider: string;
  providerTransactionId: string;
  status: "requested" | "paid" | "failed";
};

export interface PaymentProvider {
  readonly name: string;
  createPaymentRequest(input: PaymentRequestInput): Promise<PaymentResult>;
}

export class InternalPaymentProvider implements PaymentProvider {
  readonly name = "internal";
  async createPaymentRequest(): Promise<PaymentResult> {
    return {
      provider: this.name,
      providerTransactionId: `internal_${crypto.randomUUID()}`,
      status: "requested",
    };
  }
}

export class UnconfiguredPaymentProvider implements PaymentProvider {
  readonly name = "none";
  async createPaymentRequest(): Promise<PaymentResult> {
    throw new Error("Card payments are not connected. Use the internal ledger or configure Stripe later.");
  }
}

export function createPaymentProvider(): PaymentProvider {
  const driver = getEnv().PAYMENTS_DRIVER;
  if (driver === "internal" || driver === "none") return new InternalPaymentProvider();
  return new UnconfiguredPaymentProvider();
}
