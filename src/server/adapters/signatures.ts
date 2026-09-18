export type SignatureRequestInput = {
  signerName: string;
  signerEmail: string;
  documentRef: string;
};

export interface SignatureProvider {
  readonly name: string;
  requestSignature(input: SignatureRequestInput): Promise<{ providerRef: string }>;
}

export class InternalSignatureProvider implements SignatureProvider {
  readonly name = "internal";
  async requestSignature() {
    return { providerRef: `internal_${crypto.randomUUID()}` };
  }
}

export function createSignatureProvider(): SignatureProvider {
  return new InternalSignatureProvider();
}
