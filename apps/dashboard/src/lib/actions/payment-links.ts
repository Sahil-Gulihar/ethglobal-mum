"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { toUnits, fromUnits } from "@whitechain-commerce/core";
import { db, paymentLinks } from "@/lib/db";
import { requireMerchant } from "@/lib/auth";
import { usdtDecimals } from "@/lib/chain";
import { newId } from "@/lib/ids";
import { err, errorMessage, ok, type ActionResult } from "./result";

export async function createPaymentLink(input: { name: string; amount: string }): Promise<ActionResult<{ id: string }>> {
  const m = await requireMerchant();
  if (m.status !== "active") return err("Verify your account before creating payment links.");
  if (!m.payoutAddress || !m.registeredTxHash) return err("Set your payout wallet in Settings first.");
  const name = input.name.trim().slice(0, 80);
  if (!name) return err("Give the link a name, like \"Consulting call\".");
  const raw = input.amount.trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) return err("Enter an amount like 25 or 25.50.");
  let amount: string;
  try {
    const decimals = await usdtDecimals();
    const units = toUnits(raw, decimals);
    if (units <= 0n) return err("The amount must be more than 0.");
    amount = fromUnits(units, decimals);
  } catch (e) {
    return err(errorMessage(e, "Invalid amount."));
  }
  const id = newId("pl");
  await db.insert(paymentLinks).values({ id, merchantId: m.id, name, amount });
  revalidatePath("/dashboard/links");
  return ok({ id });
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
