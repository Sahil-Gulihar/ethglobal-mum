import { encodeAbiParameters, keccak256, toBytes, type Hex } from "viem";

/** Onchain merchantId = keccak256(utf8(merchant.id)), e.g. merchant.id = "mer_abc". */
export const chainMerchantId = (merchantId: string): Hex => keccak256(toBytes(merchantId));
/** Onchain orderId = keccak256(utf8(checkoutSession.id)), e.g. "cs_abc". One session = one payment. */
export const chainOrderId = (sessionId: string): Hex => keccak256(toBytes(sessionId));
/** Mirrors PaymentRouter.paymentIdOf: keccak256(abi.encode(merchantId, orderId)). */
export const chainPaymentId = (merchantId: Hex, orderId: Hex): Hex =>
  keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], [merchantId, orderId]));
