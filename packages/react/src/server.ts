/**
 * Server-only helpers. Import from "@whitechain-commerce/react/server" in route handlers / server actions.
 * Never import this file in the browser: it needs your secret key and node:crypto.
 */
import type { CheckoutSession } from "@whitechain-commerce/core";
import { apiFetch, resolveApiBase, WhitechainApiError } from "./api.js";

export { verifyWebhook, WebhookSignatureError, SIGNATURE_HEADER } from "@whitechain-commerce/core/webhooks";
export type { WebhookEvent, WebhookEventType, PaymentObject, RefundObject } from "@whitechain-commerce/core/webhooks";
export type { CheckoutSession } from "@whitechain-commerce/core";
export { WhitechainApiError } from "./api.js";

export interface CreateCheckoutSessionParams {
  /** Base URL of the Whitechain Commerce API, e.g. "http://localhost:3000". Defaults to NEXT_PUBLIC_WC_API_BASE. */
  apiBase?: string;
  /** Your secret key (sk_test_...). */
  secretKey: string;
  /** Your own order id. One session pays one order. */
  orderId: string;
  /** Decimal USDT amount as a string, e.g. "49.99" (max 6 decimals). */
  amount: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

/** Creates a checkout session on your server so the amount cannot be tampered with in the browser. */
export async function createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession> {
  const { secretKey, orderId, amount, successUrl, cancelUrl, metadata } = params;
  if (!secretKey || !secretKey.startsWith("sk_"))
    throw new WhitechainApiError(
      "createCheckoutSession: secretKey must be a secret key starting with sk_",
      0,
      "authentication",
    );
  if (!orderId) throw new WhitechainApiError("createCheckoutSession: orderId is required", 0, "invalid_request");
  if (typeof amount !== "string" || !/^\d+(\.\d{1,6})?$/.test(amount) || Number(amount) <= 0)
    throw new WhitechainApiError(
      `createCheckoutSession: amount must be a positive decimal string with at most 6 decimals, e.g. "49.99" (got ${JSON.stringify(amount)})`,
      0,
      "invalid_request",
    );
  const base = resolveApiBase(params.apiBase);
  if (!base)
    throw new WhitechainApiError(
      "createCheckoutSession: apiBase is required on the server (or set NEXT_PUBLIC_WC_API_BASE)",
      0,
      "invalid_request",
    );
  return apiFetch<CheckoutSession>(`${base}/api/v1/checkout_sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}` },
    body: JSON.stringify({ orderId, amount, currency: "USDT", successUrl, cancelUrl, metadata }),
    cache: "no-store",
  });
}
