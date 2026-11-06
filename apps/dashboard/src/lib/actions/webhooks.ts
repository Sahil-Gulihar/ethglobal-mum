"use server";

import { revalidatePath } from "next/cache";
import { requireMerchant } from "@/lib/auth";
import {
  addWebhookEndpoint,
  redeliverForMerchant,
  removeWebhookEndpoint,
  setEndpointEnabled,
  testEndpoint,
  webhookSecret,
  type AttemptSummary,
} from "@/lib/webhooks/endpoints";
import { err, ok, type ActionResult } from "./result";

export type { AttemptSummary };

export async function createWebhookEndpoint(url: string): Promise<ActionResult<{ id: string }>> {
  const m = await requireMerchant();
  const r = await addWebhookEndpoint(m.id, url);
  if (!r.ok) return err(r.message);
  revalidatePath("/dashboard", "layout");
  return ok({ id: r.value.id });
}

export async function setWebhookEndpointEnabled(id: string, enabled: boolean): Promise<ActionResult> {
  const m = await requireMerchant();
  const r = await setEndpointEnabled(m.id, id, enabled);
  if (!r.ok) return err(r.message);
  revalidatePath("/dashboard/webhooks");
  return ok(undefined);
}

export async function deleteWebhookEndpoint(id: string): Promise<ActionResult> {
  const m = await requireMerchant();
  const r = await removeWebhookEndpoint(m.id, id);
  if (!r.ok) return err(r.message);
  revalidatePath("/dashboard", "layout");
  return ok(undefined);
}

export async function revealWebhookSecret(id: string): Promise<ActionResult<string>> {
  const m = await requireMerchant();
  const r = await webhookSecret(m.id, id);
  return r.ok ? ok(r.value) : err(r.message);
}

export async function sendTestWebhook(endpointId: string): Promise<ActionResult<AttemptSummary>> {
  const m = await requireMerchant();
  const r = await testEndpoint(m.id, endpointId);
  revalidatePath("/dashboard/webhooks");
  return r.ok ? ok(r.value) : err(r.message);
}

export async function redeliverWebhook(deliveryId: string): Promise<ActionResult<AttemptSummary>> {
  const m = await requireMerchant();
  const r = await redeliverForMerchant(m.id, deliveryId);
  revalidatePath("/dashboard/webhooks");
  return r.ok ? ok(r.value) : err(r.message);
}
