import { explorerTx, fromUnits, getRouterAddress, USDT_ADDRESS } from "@whitechain-commerce/core";
import type { CheckoutSession, PublicCheckoutSession } from "@whitechain-commerce/core";
import type { PaymentObject, RefundObject } from "@whitechain-commerce/core/webhooks";
import type { checkoutSessions, merchants, payments, refunds } from "./db/schema";
import { env } from "./env";

type SessionRow = typeof checkoutSessions.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;
type RefundRow = typeof refunds.$inferSelect;
type MerchantRow = typeof merchants.$inferSelect;

export function toPaymentObject(p: PaymentRow, s: SessionRow): PaymentObject {
  return {
    id: p.id,
    sessionId: s.id,
    orderId: s.orderId,
    amount: fromUnits(p.amountUnits, p.decimals),
    amountRefunded: fromUnits(p.refundedUnits, p.decimals),
    currency: "USDT",
    status: p.status,
    payer: p.payer as `0x${string}`,
    txHash: p.txHash as `0x${string}`,
    explorerUrl: explorerTx(p.txHash),
    chainId: 1874,
    chainPaymentId: p.chainPaymentId as `0x${string}`,
    buyerVerified: !!s.humanVerifiedAt,
    buyerVerifiedVia: s.humanVerifiedAt ? (s.humanVerifiedVia ?? "zg") : null,
    createdAt: p.createdAt.toISOString(),
  };
}

export function toRefundObject(r: RefundRow, p: PaymentRow, s: SessionRow): RefundObject {
  return {
    id: r.id,
    paymentId: p.id,
    orderId: s.orderId,
    amount: fromUnits(r.amountUnits, p.decimals),
    currency: "USDT",
    status: r.status,
    txHash: (r.txHash as `0x${string}` | null) ?? null,
    explorerUrl: r.txHash ? explorerTx(r.txHash) : null,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toPublicSession(s: SessionRow, m: MerchantRow, p: PaymentRow | null): PublicCheckoutSession {
  return {
    id: s.id,
    status: s.status,
    merchant: { name: m.name },
    orderId: s.orderId,
    amount: s.amount,
    amountUnits: s.amountUnits,
    currency: "USDT",
    decimals: s.decimals,
    chainId: 1874,
    routerAddress: getRouterAddress(),
    tokenAddress: USDT_ADDRESS,
    chainMerchantId: m.chainMerchantId as `0x${string}`,
    chainOrderId: s.chainOrderId as `0x${string}`,
    expiresAt: s.expiresAt.toISOString(),
    successUrl: s.successUrl,
    cancelUrl: s.cancelUrl,
    payment: p ? { id: p.id, txHash: p.txHash as `0x${string}`, explorerUrl: explorerTx(p.txHash) } : null,
    buyerCheck: { required: m.requireVerifiedBuyers, verified: !!s.humanVerifiedAt, method: m.verifiedBuyerMethod },
  };
}

export function toCheckoutSession(s: SessionRow, m: MerchantRow, p: PaymentRow | null): CheckoutSession {
  return {
    ...toPublicSession(s, m, p),
    url: `${env.appUrl()}/checkout/${s.id}`,
    metadata: s.metadata ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}
