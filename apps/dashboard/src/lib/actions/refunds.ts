"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { isAddress, isHash, type Hex } from "viem";
import { erc20Abi, getRouterAddress, toUnits, USDT_ADDRESS } from "@whitechain-commerce/core";
import { db, payments, refunds } from "@/lib/db";
import { requireMerchant } from "@/lib/auth";
import { publicClient } from "@/lib/chain";
import { createPendingRefund } from "@/lib/refunds";
import { validateTx } from "@/lib/indexer";
import { err, errorMessage, ok, type ActionResult } from "./result";

/**
 * Records a `pending` refund row (so the indexer can match the Refunded event) and returns
 * what the browser needs to sign refund(chainPaymentId, amountUnits) from the payout wallet.
 */
export async function startRefund(
  paymentId: string,
  amount: string,
): Promise<ActionResult<{ refundId: string; amountUnits: string }>> {
  const m = await requireMerchant();
  const [p] = await db.select().from(payments).where(and(eq(payments.id, paymentId), eq(payments.merchantId, m.id))).limit(1);
  if (!p) return err("Payment not found.");
  let units: bigint;
  try {
    units = toUnits(String(amount).trim(), p.decimals);
  } catch (e) {
    return err(errorMessage(e, "Enter a valid amount."));
  }
  const r = await createPendingRefund(m.id, { paymentId, amount: String(amount).trim() });
  if (!r.ok) return err(r.message);
  revalidatePath(`/dashboard/payments/${paymentId}`);
  return ok({ refundId: r.value.id, amountUnits: units.toString() });
}

/** Removes a pending refund request that was never signed (e.g. the wallet prompt was rejected). */
export async function cancelPendingRefund(refundId: string): Promise<ActionResult> {
  const m = await requireMerchant();
  const rows = await db
    .delete(refunds)
    .where(and(eq(refunds.id, refundId), eq(refunds.merchantId, m.id), eq(refunds.status, "pending"), isNull(refunds.txHash)))
    .returning({ paymentId: refunds.paymentId });
  if (!rows.length) return err("Refund can't be discarded (not found or already processed).");
  revalidatePath(`/dashboard/payments/${rows[0].paymentId}`);
  return ok(undefined);
}

/** USDT balance and router allowance of the payout wallet, read server-side via our RPC. */
export async function payoutTokenState(owner: string): Promise<ActionResult<{ balance: string; allowance: string }>> {
  await requireMerchant();
  if (!isAddress(owner)) return err("Invalid wallet address.");
  try {
    const client = publicClient();
    const [balance, allowance] = await Promise.all([
      client.readContract({ address: USDT_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [owner] }),
      client.readContract({ address: USDT_ADDRESS, abi: erc20Abi, functionName: "allowance", args: [owner, getRouterAddress()] }),
    ]);
    return ok({ balance: (balance as bigint).toString(), allowance: (allowance as bigint).toString() });
  } catch (e) {
    return err(`Couldn't read the wallet balance: ${errorMessage(e)}`);
  }
}

/** Polled by the browser after it broadcasts a tx. */
export async function txStatus(hash: string): Promise<ActionResult<"pending" | "success" | "reverted">> {
  await requireMerchant();
  if (!isHash(hash)) return err("Invalid transaction hash.");
  try {
    const receipt = await publicClient().getTransactionReceipt({ hash: hash as Hex });
    return ok(receipt.status === "success" ? "success" : "reverted");
  } catch {
    return ok("pending"); // not mined yet (TransactionReceiptNotFoundError) or a transient RPC error
  }
}

/**
 * Runs the indexer's full settlement check on a just-confirmed refund tx so the dashboard
 * doesn't have to wait for the next worker pass. Idempotent; the worker would do the same.
 */
export async function indexRefundTx(paymentId: string, hash: string): Promise<ActionResult<boolean>> {
  await requireMerchant();
  if (!isHash(hash)) return err("Invalid transaction hash.");
  try {
    const r = await validateTx(hash as Hex);
    revalidatePath(`/dashboard/payments/${paymentId}`);
    return ok(r.ok);
  } catch (e) {
    return err(errorMessage(e));
  }
}
