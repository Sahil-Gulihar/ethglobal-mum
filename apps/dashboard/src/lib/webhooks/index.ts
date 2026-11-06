import "server-only";
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { signWebhook } from "@whitechain-commerce/core/webhooks";
import type { PaymentObject, RefundObject, WebhookEvent, WebhookEventType } from "@whitechain-commerce/core/webhooks";
import { db, webhookAttempts, webhookDeliveries, webhookEndpoints, webhookEvents } from "@/lib/db";
import { newId } from "@/lib/ids";
import { checkWebhookUrl } from "./url-guard";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbOrTx = typeof db | Tx;

export type EventData<T extends WebhookEventType> = Extract<WebhookEvent, { type: T }>["data"];

export const USER_AGENT = "WhitechainCommerce-Webhooks/1.0";
export const TIMEOUT_MS = 10_000;
/** Delay after the Nth failed attempt (1-based). After MAX_ATTEMPTS failures the delivery is `failed`. */
export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000];
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1; // 4
/** While a worker holds a claimed delivery, nobody else may pick it up for this long. */
const CLAIM_LEASE_MS = 60_000;
const BATCH = 25;

/**
 * Creates one webhook_events row (payload = full WebhookEvent JSON) and one pending delivery per
 * enabled endpoint of the merchant. Pass the surrounding transaction so the event commits atomically
 * with the state change that caused it.
 */
export async function enqueueEvent<T extends WebhookEventType>(
  tx: DbOrTx,
  merchantId: string,
  type: T,
  data: EventData<T>,
): Promise<{ eventId: string; deliveries: number }> {
  const id = newId("evt");
  const payload = { id, type, created: Math.floor(Date.now() / 1000), data } as WebhookEvent;
  await tx.insert(webhookEvents).values({ id, merchantId, type, payload });
  const endpoints = await tx
    .select({ id: webhookEndpoints.id })
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.merchantId, merchantId), eq(webhookEndpoints.enabled, true)));
  if (endpoints.length) {
    await tx
      .insert(webhookDeliveries)
      .values(endpoints.map((e) => ({ id: newId("whd"), eventId: id, endpointId: e.id })));
  }
  return { eventId: id, deliveries: endpoints.length };
}

export interface AttemptResult {
  deliveryId: string;
  ok: boolean;
  statusCode: number | null;
  error: string | null;
  durationMs: number;
  attempt: number;
  status: "pending" | "succeeded" | "failed";
}

type Claimed = { id: string; attempts: number };

/**
 * Sends every pending delivery whose nextAttemptAt <= now. Rows are claimed with
 * FOR UPDATE SKIP LOCKED and leased (nextAttemptAt pushed forward) before any HTTP call,
 * to reduce concurrent sends. Delivery is at least once, including after a lease expires.
 * Returns the number of attempts made.
 */
export async function deliverDue(): Promise<number> {
  let total = 0;
  for (let round = 0; round < 4; round++) {
    const claimed = await claimDue(BATCH);
    if (!claimed.length) break;
    await Promise.all(claimed.map((c) => attempt(c.id, c.attempts)));
    total += claimed.length;
    if (claimed.length < BATCH) break;
  }
  return total;
}

async function claimDue(limit: number): Promise<Claimed[]> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: webhookDeliveries.id, attempts: webhookDeliveries.attempts })
      .from(webhookDeliveries)
      .where(and(eq(webhookDeliveries.status, "pending"), lte(webhookDeliveries.nextAttemptAt, new Date())))
      .orderBy(asc(webhookDeliveries.nextAttemptAt))
      .limit(limit)
      .for("update", { skipLocked: true });
    if (rows.length) {
      await tx
        .update(webhookDeliveries)
        .set({ nextAttemptAt: new Date(Date.now() + CLAIM_LEASE_MS) })
        .where(inArray(webhookDeliveries.id, rows.map((r) => r.id)));
    }
    return rows;
  });
}

/**
 * Claims a single delivery regardless of its schedule (used by redeliver / test sends).
 * With reset, the attempt counter restarts so a failure gets a fresh retry schedule.
 */
async function claimOne(deliveryId: string, reset = false): Promise<Claimed | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: webhookDeliveries.id, attempts: webhookDeliveries.attempts })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId))
      .for("update", { skipLocked: true });
    if (!row) return null;
    await tx
      .update(webhookDeliveries)
      .set({
        nextAttemptAt: new Date(Date.now() + CLAIM_LEASE_MS),
        ...(reset ? { status: "pending" as const, attempts: 0 } : {}),
      })
      .where(eq(webhookDeliveries.id, deliveryId));
    return reset ? { id: row.id, attempts: 0 } : row;
  });
}

/** One HTTP attempt for a claimed delivery; records webhook_attempts and updates the delivery. */
async function attempt(deliveryId: string, prevAttempts: number): Promise<AttemptResult> {
  const [row] = await db
    .select({
      url: webhookEndpoints.url,
      secret: webhookEndpoints.secret,
      enabled: webhookEndpoints.enabled,
      payload: webhookEvents.payload,
    })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
    .innerJoin(webhookEvents, eq(webhookEvents.id, webhookDeliveries.eventId))
    .where(eq(webhookDeliveries.id, deliveryId));

  const attemptNo = prevAttempts + 1;
  const started = Date.now();
  let statusCode: number | null = null;
  let error: string | null = null;
  let responseBody: string | null = null;

  let terminal = !row; // true = never retry this delivery
  const blockedReason = row && row.enabled ? await checkWebhookUrl(row.url) : null;
  if (!row) {
    error = "delivery not found";
  } else if (!row.enabled) {
    error = "Endpoint is disabled";
    terminal = true;
  } else if (blockedReason) {
    error = `Blocked: ${blockedReason}`;
    terminal = true;
  } else {
    // jsonb is canonical, so this string is stable across attempts; we sign exactly what we send.
    const body = JSON.stringify(row.payload);
    const signature = signWebhook(row.secret, body, Math.floor(Date.now() / 1000));
    try {
      const res = await fetch(row.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "WC-Signature": signature, "User-Agent": USER_AGENT },
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      statusCode = res.status;
      try {
        responseBody = truncate(await res.text(), 1024);
      } catch {
        responseBody = null;
      }
      if (res.status < 200 || res.status >= 300) error = `HTTP ${res.status}`;
    } catch (e) {
      error = describeFetchError(e);
    }
  }

  const durationMs = Date.now() - started;
  const ok = statusCode !== null && statusCode >= 200 && statusCode < 300;
  // Test events are one-shot: a failure is shown to the merchant right away, not retried.
  if (row && isTestEvent(row.payload)) terminal = true;
  const status: AttemptResult["status"] = ok ? "succeeded" : attemptNo >= MAX_ATTEMPTS || terminal ? "failed" : "pending";
  const nextAttemptAt = status === "pending" ? new Date(Date.now() + RETRY_DELAYS_MS[attemptNo - 1]) : new Date();

  await db.transaction(async (tx) => {
    await tx.insert(webhookAttempts).values({
      id: newId("wha"),
      deliveryId,
      attempt: attemptNo,
      statusCode,
      error: error ? truncate(error, 1024) : null,
      responseBody,
      durationMs,
    });
    await tx
      .update(webhookDeliveries)
      .set({
        status,
        attempts: attemptNo,
        nextAttemptAt,
        lastStatusCode: statusCode,
        lastError: error ? truncate(error, 1024) : null,
        lastAttemptAt: new Date(),
      })
      .where(eq(webhookDeliveries.id, deliveryId));
  });

  return { deliveryId, ok, statusCode, error, durationMs, attempt: attemptNo, status };
}

/**
 * Re-sends a delivery right now (dashboard "Resend"). Resets a failed/succeeded delivery's
 * attempt counter so it gets a fresh retry schedule if this attempt fails.
 * Pass merchantId to enforce ownership.
 */
export async function redeliver(deliveryId: string, merchantId?: string): Promise<AttemptResult> {
  const [d] = await db
    .select({ id: webhookDeliveries.id, status: webhookDeliveries.status, merchantId: webhookEndpoints.merchantId })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
    .where(eq(webhookDeliveries.id, deliveryId));
  if (!d || (merchantId && d.merchantId !== merchantId)) throw new Error("Delivery not found");
  const claimed = await claimOne(deliveryId, true);
  if (!claimed) throw new Error("Delivery is being sent by another worker, try again");
  return attempt(claimed.id, claimed.attempts);
}

/** Synthetic events from "Send test" carry a payment id prefixed "pay_test_". */
export function isTestEvent(payload: unknown): boolean {
  const id = (payload as { data?: { payment?: { id?: unknown } } } | null)?.data?.payment?.id;
  return typeof id === "string" && id.startsWith("pay_test_");
}

/**
 * Sends a synthetic payment.succeeded event (ids prefixed "pay_test_", orderId "test_order")
 * to one endpoint and delivers it immediately. Failed test sends are not retried.
 */
export async function sendTestEvent(
  endpointId: string,
  merchantId?: string,
): Promise<AttemptResult & { eventId: string }> {
  const [ep] = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, endpointId));
  if (!ep || (merchantId && ep.merchantId !== merchantId)) throw new Error("Endpoint not found");

  const now = new Date();
  const fakeTx = `0x${"0".repeat(63)}1` as `0x${string}`;
  const payment: PaymentObject = {
    id: `pay_test_${Date.now()}`,
    sessionId: "cs_test",
    orderId: "test_order",
    amount: "1.00",
    amountRefunded: "0.00",
    currency: "USDT",
    status: "succeeded",
    payer: "0x000000000000000000000000000000000000dEaD",
    txHash: fakeTx,
    explorerUrl: "",
    chainId: 1874,
    chainPaymentId: `0x${"0".repeat(64)}`,
    createdAt: now.toISOString(),
  };

  const eventId = newId("evt");
  const deliveryId = newId("whd");
  const payload: WebhookEvent = { id: eventId, type: "payment.succeeded", created: Math.floor(now.getTime() / 1000), data: { payment } };
  await db.transaction(async (tx) => {
    await tx.insert(webhookEvents).values({ id: eventId, merchantId: ep.merchantId, type: "payment.succeeded", payload });
    // nextAttemptAt in the future so deliverDue doesn't race us before we claim it below.
    await tx.insert(webhookDeliveries).values({
      id: deliveryId,
      eventId,
      endpointId,
      nextAttemptAt: new Date(Date.now() + CLAIM_LEASE_MS),
    });
  });
  const claimed = await claimOne(deliveryId);
  if (!claimed) throw new Error("Could not claim test delivery");
  return { ...(await attempt(claimed.id, claimed.attempts)), eventId };
}

export type { PaymentObject, RefundObject, WebhookEvent, WebhookEventType };

function truncate(s: string, max: number): string {
  // Truncate by bytes (UTF-8) so the stored body stays <= max bytes.
  const buf = Buffer.from(s, "utf8");
  if (buf.length <= max) return s;
  return buf.subarray(0, max).toString("utf8").replace(/�+$/, "");
}

function describeFetchError(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === "TimeoutError" || e.name === "AbortError") return `Timed out after ${TIMEOUT_MS / 1000}s`;
    const cause = (e as Error & { cause?: { code?: string; message?: string } }).cause;
    return cause?.code ? `${e.message}: ${cause.code}` : cause?.message ? `${e.message}: ${cause.message}` : e.message;
  }
  return String(e);
}
