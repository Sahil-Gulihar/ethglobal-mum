"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, webhookEndpoints } from "@/lib/db";
import { requireMerchant } from "@/lib/auth";
import { newId, randomId } from "@/lib/ids";
import { redeliver, sendTestEvent } from "@/lib/webhooks";
import { checkWebhookUrl } from "@/lib/webhooks/url-guard";
import { err, errorMessage, ok, type ActionResult } from "./result";

const MAX_ENDPOINTS = 10;

function parseUrl(input: string): URL | null {
  try {
    const u = new URL(input.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

export async function createWebhookEndpoint(url: string): Promise<ActionResult<{ id: string }>> {
  const m = await requireMerchant();
  const u = parseUrl(url);
  if (!u) return err("Enter a full http(s) URL, e.g. https://shop.example.com/api/webhooks.");
  const blocked = await checkWebhookUrl(u.toString());
  if (blocked) return err(blocked);
  const existing = await db.select({ id: webhookEndpoints.id }).from(webhookEndpoints).where(eq(webhookEndpoints.merchantId, m.id));
  if (existing.length >= MAX_ENDPOINTS) return err(`You can add up to ${MAX_ENDPOINTS} endpoints.`);
  const id = newId("we");
  await db.insert(webhookEndpoints).values({ id, merchantId: m.id, url: u.toString(), secret: `whsec_${randomId(32)}` });
  revalidatePath("/dashboard", "layout");
  return ok({ id });
}

export async function setWebhookEndpointEnabled(id: string, enabled: boolean): Promise<ActionResult> {
  const m = await requireMerchant();
  const rows = await db
    .update(webhookEndpoints)
    .set({ enabled })
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.merchantId, m.id)))
    .returning({ id: webhookEndpoints.id });
  if (!rows.length) return err("Endpoint not found.");
  revalidatePath("/dashboard/webhooks");
  return ok(undefined);
}

export async function deleteWebhookEndpoint(id: string): Promise<ActionResult> {
  const m = await requireMerchant();
  const rows = await db
    .delete(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.merchantId, m.id)))
    .returning({ id: webhookEndpoints.id });
  if (!rows.length) return err("Endpoint not found.");
  revalidatePath("/dashboard", "layout");
  return ok(undefined);
}

export async function revealWebhookSecret(id: string): Promise<ActionResult<string>> {
  const m = await requireMerchant();
  const [row] = await db
    .select({ secret: webhookEndpoints.secret })
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.merchantId, m.id)))
    .limit(1);
  return row ? ok(row.secret) : err("Endpoint not found.");
}

export type AttemptSummary = { ok: boolean; statusCode: number | null; error: string | null; durationMs: number };

export async function sendTestWebhook(endpointId: string): Promise<ActionResult<AttemptSummary>> {
  const m = await requireMerchant();
  try {
    const r = await sendTestEvent(endpointId, m.id);
    revalidatePath("/dashboard/webhooks");
    return ok({ ok: r.ok, statusCode: r.statusCode, error: r.error, durationMs: r.durationMs });
  } catch (e) {
    return err(errorMessage(e));
  }
}

export async function redeliverWebhook(deliveryId: string): Promise<ActionResult<AttemptSummary>> {
  const m = await requireMerchant();
  try {
    const r = await redeliver(deliveryId, m.id);
    revalidatePath("/dashboard/webhooks");
    return ok({ ok: r.ok, statusCode: r.statusCode, error: r.error, durationMs: r.durationMs });
  } catch (e) {
    return err(errorMessage(e));
  }
}
