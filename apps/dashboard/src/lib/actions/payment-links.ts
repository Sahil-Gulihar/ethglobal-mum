"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, paymentLinks } from "@/lib/db";
import { requireMerchant } from "@/lib/auth";
import { createPaymentLinkForMerchant } from "@/lib/payment-links";
import { err, ok, type ActionResult } from "./result";

export async function createPaymentLink(input: { name: string; amount: string }): Promise<ActionResult<{ id: string }>> {
  const m = await requireMerchant();
  const r = await createPaymentLinkForMerchant(m, input);
  if (!r.ok) return err(r.message);
  revalidatePath("/dashboard/links");
  return ok({ id: r.value.id });
}

export async function setPaymentLinkActive(id: string, active: boolean): Promise<ActionResult> {
  const m = await requireMerchant();
  const rows = await db
    .update(paymentLinks)
    .set({ active })
    .where(and(eq(paymentLinks.id, id), eq(paymentLinks.merchantId, m.id)))
    .returning({ id: paymentLinks.id });
  if (!rows.length) return err("Payment link not found.");
  revalidatePath("/dashboard/links");
  return ok(undefined);
}
