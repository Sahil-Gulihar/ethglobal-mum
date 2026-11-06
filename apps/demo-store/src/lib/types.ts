export type OrderStatus = "pending" | "paid" | "partially_refunded" | "refunded";

export interface OrderItem {
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
}

export interface OrderRefund {
  id: string;
  amount: string;
  txHash: string | null;
  explorerUrl: string | null;
  eventId: string;
  recordedAt: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  totalCents: number;
  total: string; // "14.98"
  status: OrderStatus;
  sessionId: string | null;
  checkoutUrl: string | null;
  createdAt: string;
  paidAt: string | null;
  fulfilledByEventId: string | null;
  payment: {
    id: string;
    txHash: string;
    explorerUrl: string;
    payer: string;
    amount: string;
  } | null;
  amountRefunded: string;
  refunds: OrderRefund[];
}

export interface WebhookLogEntry {
  receivedAt: string;
  verified: boolean;
  eventId: string | null;
  type: string | null;
  orderId: string | null;
  outcome: string; // human readable result
  duplicate: boolean;
  /** The store itself is misconfigured (e.g. WC_WEBHOOK_SECRET missing), not a bad signature. */
  setupError?: boolean;
}

export interface StoreData {
  orders: Record<string, Order>;
  processedEventIds: string[];
  webhookLog: WebhookLogEntry[];
}
