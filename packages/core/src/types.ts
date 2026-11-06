/** Public (no-secret) view of a checkout session: GET /api/v1/checkout_sessions/:id */
export interface PublicCheckoutSession {
  id: string; // cs_...
  status: "open" | "processing" | "paid" | "expired";
  merchant: { name: string };
  orderId: string;
  amount: string; // "49.99"
  amountUnits: string; // "49990000" (bigint as string)
  currency: "USDT";
  decimals: number;
  chainId: 1874;
  routerAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  chainMerchantId: `0x${string}`;
  chainOrderId: `0x${string}`;
  expiresAt: string; // ISO
  successUrl: string | null;
  cancelUrl: string | null;
  payment: { id: string; txHash: `0x${string}`; explorerUrl: string } | null;
  /** Verified buyers (0G human check). `required` is the merchant's setting; `verified` is true once this buyer passed. */
  buyerCheck?: { required: boolean; verified: boolean };
}

/** Secret view returned to the merchant's server: POST/GET with sk_ key */
export interface CheckoutSession extends PublicCheckoutSession {
  url: string; // hosted checkout URL
  metadata: Record<string, string> | null;
  createdAt: string;
}

export interface ApiError {
  error: { type: "invalid_request" | "authentication" | "not_found" | "conflict" | "server_error"; message: string };
}
