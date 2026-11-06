from typing import Literal, TypedDict


class Merchant(TypedDict):
    name: str


class SessionPayment(TypedDict):
    id: str
    txHash: str
    explorerUrl: str


class CheckoutSession(TypedDict):
    id: str
    url: str
    status: Literal["open", "processing", "paid", "expired"]
    merchant: Merchant
    orderId: str
    amount: str
    amountUnits: str
    currency: Literal["USDT"]
    decimals: int
    chainId: int
    routerAddress: str
    tokenAddress: str
    chainMerchantId: str
    chainOrderId: str
    expiresAt: str
    successUrl: str | None
    cancelUrl: str | None
    payment: SessionPayment | None
    metadata: dict[str, str] | None
    createdAt: str


class Payment(TypedDict):
    id: str
    sessionId: str
    orderId: str
    amount: str
    amountRefunded: str
    currency: Literal["USDT"]
    status: Literal["succeeded", "partially_refunded", "refunded"]
    payer: str
    txHash: str
    explorerUrl: str
    chainId: int
    chainPaymentId: str
    createdAt: str


class Refund(TypedDict):
    id: str
    paymentId: str
    orderId: str
    amount: str
    currency: Literal["USDT"]
    status: Literal["pending", "succeeded"]
    txHash: str | None
    explorerUrl: str | None
    createdAt: str
