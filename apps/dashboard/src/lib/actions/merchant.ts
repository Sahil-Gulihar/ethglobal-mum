"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getAddress, isAddress, zeroAddress, type Hex } from "viem";
import { z } from "zod";
import { getRouterAddress } from "@whitechain-commerce/core";
import { db, merchants } from "@/lib/db";
import { requireMerchant } from "@/lib/auth";
import { registerMerchantOnchain } from "@/lib/chain";
import { err, errorMessage, ok, type ActionResult } from "./result";

/**
 * Validates the payout address and has the backend signer (router owner) call
 * registerMerchant(chainMerchantId, payout). Waits for the receipt, then stores it.
 * Also used to change the payout later (registerMerchant overwrites it onchain).
 */
export async function setPayoutAddress(address: string): Promise<ActionResult<{ payoutAddress: string; txHash: string }>> {
  const m = await requireMerchant();
  if (m.status !== "active") return err("Verify your account before adding a payout wallet.");
  const raw = String(address ?? "").trim();
  if (!isAddress(raw, { strict: false })) return err("That isn't a valid wallet address.");
  const payout = getAddress(raw);
  if (payout === zeroAddress) return err("The zero address can't receive payouts.");
  if (getRouterAddress() === zeroAddress) return err("The PaymentRouter isn't deployed yet. Set PAYMENT_ROUTER_ADDRESS and try again.");
  if (m.payoutAddress && m.payoutAddress.toLowerCase() === payout.toLowerCase() && m.registeredTxHash) {
    return ok({ payoutAddress: payout, txHash: m.registeredTxHash });
  }

  let txHash: string;
  try {
    txHash = await registerMerchantOnchain(m.chainMerchantId as Hex, payout);
  } catch (e) {
    console.error("registerMerchant failed", e);
    return err(`Onchain registration failed: ${errorMessage(e)}`);
  }
  await db.update(merchants).set({ payoutAddress: payout, registeredTxHash: txHash }).where(eq(merchants.id, m.id));
  revalidatePath("/dashboard", "layout");
  return ok({ payoutAddress: payout, txHash });
}

export type NameFormState = { error?: string; saved?: boolean };

export async function updateBusinessName(_prev: NameFormState, formData: FormData): Promise<NameFormState> {
  const m = await requireMerchant();
  const parsed = z.string().trim().min(2, "Business name must be at least 2 characters.").max(80, "Keep it under 80 characters.").safeParse(formData.get("name") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await db.update(merchants).set({ name: parsed.data }).where(eq(merchants.id, m.id));
  revalidatePath("/dashboard", "layout");
  return { saved: true };
}
