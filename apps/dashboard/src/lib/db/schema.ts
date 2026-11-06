import { pgTable, text, timestamp, integer, boolean, jsonb, bigint, index, uniqueIndex } from "drizzle-orm/pg-core";

// Amounts in token base units are stored as text (bigint-safe); convert with BigInt().

export const merchants = pgTable("merchants", {
  id: text("id").primaryKey(), // mer_...
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  /** pending until World ID verification (or SKIP_WORLD_ID=true in dev) */
  status: text("status", { enum: ["pending", "active"] }).notNull().default("pending"),
  worldNullifier: text("world_nullifier").unique(),
  payoutAddress: text("payout_address"),
  chainMerchantId: text("chain_merchant_id").notNull().unique(), // keccak256(id)
  registeredTxHash: text("registered_tx_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authSessions = pgTable("auth_sessions", {
  id: text("id").primaryKey(), // random token (hashed? no: random 32 bytes hex, stored as sha256)
  merchantId: text("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(), // key_...
  merchantId: text("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Default"),
  prefix: text("prefix").notNull(), // first 12 chars, e.g. "sk_test_ab12", for display
  keyHash: text("key_hash").notNull().unique(), // sha256 hex of full key
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const checkoutSessions = pgTable(
  "checkout_sessions",
  {
    id: text("id").primaryKey(), // cs_...
    merchantId: text("merchant_id").notNull().references(() => merchants.id),
    orderId: text("order_id").notNull(), // merchant's own order id
    chainOrderId: text("chain_order_id").notNull().unique(), // keccak256(id)
    amount: text("amount").notNull(), // "49.99"
    amountUnits: text("amount_units").notNull(), // "49990000"
    decimals: integer("decimals").notNull(),
    currency: text("currency").notNull().default("USDT"),
    status: text("status", { enum: ["open", "processing", "paid", "expired"] }).notNull().default("open"),
    /** tx hash reported by the widget; a hint for the indexer, never trusted alone */
    submittedTxHash: text("submitted_tx_hash"),
    successUrl: text("success_url"),
    cancelUrl: text("cancel_url"),
    metadata: jsonb("metadata").$type<Record<string, string>>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cs_merchant_idx").on(t.merchantId)],
);

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(), // pay_...
    sessionId: text("session_id").notNull().unique().references(() => checkoutSessions.id),
    merchantId: text("merchant_id").notNull().references(() => merchants.id),
    chainPaymentId: text("chain_payment_id").notNull().unique(),
    payer: text("payer").notNull(),
    payout: text("payout").notNull(),
    amountUnits: text("amount_units").notNull(),
    refundedUnits: text("refunded_units").notNull().default("0"),
    decimals: integer("decimals").notNull(),
    status: text("status", { enum: ["succeeded", "partially_refunded", "refunded"] }).notNull().default("succeeded"),
    txHash: text("tx_hash").notNull().unique(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    logIndex: integer("log_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pay_merchant_idx").on(t.merchantId)],
);

export const refunds = pgTable(
  "refunds",
  {
    id: text("id").primaryKey(), // re_...
    paymentId: text("payment_id").notNull().references(() => payments.id),
    merchantId: text("merchant_id").notNull().references(() => merchants.id),
    amountUnits: text("amount_units").notNull(),
    status: text("status", { enum: ["pending", "succeeded"] }).notNull().default("pending"),
    txHash: text("tx_hash"),
    blockNumber: bigint("block_number", { mode: "bigint" }),
    logIndex: integer("log_index"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("refund_tx_log_idx").on(t.txHash, t.logIndex)],
);

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: text("id").primaryKey(), // we_...
  merchantId: text("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: text("secret").notNull(), // whsec_... (needed in plaintext to sign)
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(), // evt_...
  merchantId: text("merchant_id").notNull().references(() => merchants.id),
  type: text("type", { enum: ["payment.succeeded", "refund.succeeded"] }).notNull(),
  payload: jsonb("payload").notNull(), // full WebhookEvent JSON
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(), // whd_...
    eventId: text("event_id").notNull().references(() => webhookEvents.id),
    endpointId: text("endpoint_id").notNull().references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "succeeded", "failed"] }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lastStatusCode: integer("last_status_code"),
    lastError: text("last_error"),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("whd_due_idx").on(t.status, t.nextAttemptAt)],
);

/** One row per HTTP attempt, shown in the dashboard webhook log. */
export const webhookAttempts = pgTable("webhook_attempts", {
  id: text("id").primaryKey(),
  deliveryId: text("delivery_id").notNull().references(() => webhookDeliveries.id, { onDelete: "cascade" }),
  attempt: integer("attempt").notNull(),
  statusCode: integer("status_code"),
  error: text("error"),
  responseBody: text("response_body"), // truncated to 1 KB
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const indexerState = pgTable("indexer_state", {
  key: text("key").primaryKey(), // "payment_router"
  lastBlock: bigint("last_block", { mode: "bigint" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
