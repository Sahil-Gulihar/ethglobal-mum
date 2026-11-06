"use server";

import { apiKeys, db } from "@/lib/db";
import { getCurrentMerchant } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { parseConnectRequest } from "@/lib/agent/connect-code";
import { err, ok, type ActionResult } from "./result";

function isUniqueViolation(e: unknown): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur; i++) {
    if (typeof cur === "object" && cur !== null && "code" in cur && (cur as { code?: string }).code === "23505") return true;
    cur = typeof cur === "object" && cur !== null && "cause" in cur ? (cur as { cause?: unknown }).cause : undefined;
  }
  return false;
}

/**
 * Approves an agent's connect request. The agent made the key itself and only sent its sha256, so
 * this stores that hash as a normal API key for the logged-in merchant. The plaintext never reaches us.
 */
export async function approveAgentConnect(input: { h: string; p: string; n: string }): Promise<ActionResult<{ name: string }>> {
  const m = await getCurrentMerchant();
  if (!m) return err("Your session has ended. Log in again, then reopen the link from your agent.");
  const req = parseConnectRequest(input);
  if (!req) return err("This connect link is invalid. Ask your agent to start again.");
  if (m.status !== "active") return err("Verify your account before connecting an agent.");

  try {
    await db.insert(apiKeys).values({
      id: newId("key"),
      merchantId: m.id,
      name: `Agent: ${req.name}`,
      prefix: req.prefix,
      keyHash: req.hash,
    });
  } catch (e) {
    if (isUniqueViolation(e)) return err("This agent is already connected.");
    console.error("agent connect failed", e);
    return err("We couldn't connect the agent. Try again.");
  }
  // No revalidatePath: it would re-render /connect and replace the success state with "already connected".
  return ok({ name: req.name });
}
