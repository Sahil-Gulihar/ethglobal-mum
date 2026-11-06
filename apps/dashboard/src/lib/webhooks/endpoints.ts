/**
 * Merchant-scoped webhook endpoint management, shared by the dashboard actions and the MCP server
 * so humans and agents follow the same rules.
 */
import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, webhookEndpoints } from "@/lib/db";
import { newId, randomId } from "@/lib/ids";
import { redeliver, sendTestEvent } from "./index";
import { checkWebhookUrl } from "./url-guard";

export const MAX_ENDPOINTS = 10;

type Result<T> = { ok: true; value: T } | { ok: false; message: string };
const fail = (message: string) => ({ ok: false, message }) as const;

function parseUrl(input: string): URL | null {
  try {
    const u = new URL(input.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

export async function listWebhookEndpoints(merchantId: string) {
  return db
    .select({ id: webhookEndpoints.id, url: webhookEndpoints.url, enabled: webhookEndpoints.enabled, createdAt: webhookEndpoints.createdAt })
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.merchantId, merchantId))
    .orderBy(desc(webhookEndpoints.createdAt));
}

export async function addWebhookEndpoint(merchantId: string, url: string): Promise<Result<{ id: string; url: string; secret: string }>> {
  const u = parseUrl(url);
  if (!u) return fail("Enter a full http(s) URL, e.g. https://shop.example.com/api/webhooks.");
  const blocked = await checkWebhookUrl(u.toString());
  if (blocked) return fail(blocked);
  const existing = await db.select({ id: webhookEndpoints.id }).from(webhookEndpoints).where(eq(webhookEndpoints.merchantId, merchantId));
  if (existing.length >= MAX_ENDPOINTS) return fail(`You can add up to ${MAX_ENDPOINTS} endpoints.`);
  const row = { id: newId("we"), merchantId, url: u.toString(), secret: `whsec_${randomId(32)}` };
  await db.insert(webhookEndpoints).values(row);
  return { ok: true, value: { id: row.id, url: row.url, secret: row.secret } };
}

export async function setEndpointEnabled(merchantId: string, id: string, enabled: boolean): Promise<Result<{ id: string; enabled: boolean }>> {
  const rows = await db
    .update(webhookEndpoints)
    .set({ enabled })
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.merchantId, merchantId)))
    .returning({ id: webhookEndpoints.id, enabled: webhookEndpoints.enabled });
  return rows.length ? { ok: true, value: rows[0] } : fail("Endpoint not found.");
}

export async function removeWebhookEndpoint(merchantId: string, id: string): Promise<Result<{ id: string }>> {
  const rows = await db
    .delete(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.merchantId, merchantId)))
    .returning({ id: webhookEndpoints.id });
  return rows.length ? { ok: true, value: rows[0] } : fail("Endpoint not found.");
}

export async function webhookSecret(merchantId: string, id: string): Promise<Result<string>> {
  const [row] = await db
    .select({ secret: webhookEndpoints.secret })
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.merchantId, merchantId)))
    .limit(1);
  return row ? { ok: true, value: row.secret } : fail("Endpoint not found.");
}

export type AttemptSummary = { ok: boolean; statusCode: number | null; error: string | null; durationMs: number };

const summarize = (r: AttemptSummary): AttemptSummary => ({ ok: r.ok, statusCode: r.statusCode, error: r.error, durationMs: r.durationMs });

export async function testEndpoint(merchantId: string, endpointId: string): Promise<Result<AttemptSummary>> {
  try {
    return { ok: true, value: summarize(await sendTestEvent(endpointId, merchantId)) };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not send the test event.");
  }
}

export async function redeliverForMerchant(merchantId: string, deliveryId: string): Promise<Result<AttemptSummary>> {
  try {
    return { ok: true, value: summarize(await redeliver(deliveryId, merchantId)) };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not redeliver the event.");
  }
}
