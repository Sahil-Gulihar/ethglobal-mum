import { createHmac, timingSafeEqual } from "node:crypto";

/** Header name: WC-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, `${t}.${body}`)> */
export const SIGNATURE_HEADER = "wc-signature";
export const DEFAULT_TOLERANCE_SECONDS = 300;

export function signWebhook(secret: string, body: string, timestamp: number): string {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

export class WebhookSignatureError extends Error {}

/** Verifies the header against the RAW request body. Returns the parsed event. */
export function verifyWebhook<T = WebhookEvent>(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
  nowSeconds = Math.floor(Date.now() / 1000),
): T {
  if (!header) throw new WebhookSignatureError("Missing WC-Signature header");
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!t || !v1) throw new WebhookSignatureError("Malformed WC-Signature header");
  if (Math.abs(nowSeconds - t) > toleranceSeconds) throw new WebhookSignatureError("Timestamp outside tolerance");
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new WebhookSignatureError("Signature mismatch");
  return JSON.parse(rawBody) as T;
}

export type WebhookEventType = "payment.succeeded" | "refund.succeeded";

export interface PaymentObject {
  id: string; // pay_...
  sessionId: string; // cs_...
  orderId: string; // merchant's own order id
  amount: string; // decimal string, e.g. "49.99"
  amountRefunded: string;
  currency: "USDT";
  status: "succeeded" | "partially_refunded" | "refunded";
  payer: `0x${string}`;
  txHash: `0x${string}`;
  explorerUrl: string;
  chainId: 1874;
  chainPaymentId: `0x${string}`;
  /** True when the buyer proved they're human (World ID, or the 0G human check / badge) before paying. */
  buyerVerified?: boolean;
  /** How the buyer was verified, when `buyerVerified` is true. */
  buyerVerifiedVia?: "world_id" | "zg" | "zg_badge" | null;
  createdAt: string; // ISO
}

export interface RefundObject {
  id: string; // re_...
  paymentId: string;
  orderId: string;
  amount: string;
  currency: "USDT";
  status: "pending" | "succeeded";
  txHash: `0x${string}` | null;
  explorerUrl: string | null;
  createdAt: string;
}

export type WebhookEvent =
  | { id: string; type: "payment.succeeded"; created: number; data: { payment: PaymentObject } }
  | { id: string; type: "refund.succeeded"; created: number; data: { refund: RefundObject; payment: PaymentObject } };
