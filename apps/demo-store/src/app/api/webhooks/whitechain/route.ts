import { verifyWebhook, type WebhookEvent } from "@whitechain-commerce/react/server";
import { updateStore } from "@/lib/db";
import { requireEnv } from "@/lib/env";
import type { WebhookLogEntry } from "@/lib/types";

const MAX_LOG = 200;

/** "14.98" / "14.980000" -> 14980000n (6 dp), so amounts compare exactly. */
function toMicro(amount: string): bigint {
  const [whole, frac = ""] = amount.split(".");
  return BigInt(whole || "0") * 1_000_000n + BigInt((frac + "000000").slice(0, 6));
}

// POST /api/webhooks/whitechain
// This is the ONLY place an order becomes paid. The browser's onSuccess callback just redirects.
export async function POST(req: Request) {
  const raw = await req.text(); // raw body: the signature covers these exact bytes
  const header = req.headers.get("wc-signature");

  let event: WebhookEvent;
  try {
    event = verifyWebhook<WebhookEvent>(raw, header, requireEnv("WC_WEBHOOK_SECRET"));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[webhook] ✗ signature verification FAILED: ${reason}. Rejecting with 400.`);
    await updateStore((data) => {
      log(data.webhookLog, {
        receivedAt: new Date().toISOString(),
        verified: false,
        eventId: null,
        type: null,
        orderId: null,
        outcome: `Rejected: ${reason}`,
        duplicate: false,
      });
    });
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log(`[webhook] ✓ signature verified for ${event.id} (${event.type})`);

  const outcome = await updateStore((data) => {
    const orderId = (event.data as { payment?: { orderId?: string } })?.payment?.orderId ?? null;
    const entry: WebhookLogEntry = {
      receivedAt: new Date().toISOString(),
      verified: true,
      eventId: event.id,
      type: event.type,
      orderId,
      outcome: "",
      duplicate: false,
    };

    if (data.processedEventIds.includes(event.id)) {
      entry.duplicate = true;
      entry.outcome = "Duplicate delivery, already processed (ignored)";
      log(data.webhookLog, entry);
      return entry.outcome;
    }

    const order = orderId ? data.orders[orderId] : undefined;
    if (!order) {
      entry.outcome = `Unknown order ${orderId} (ignored)`;
    } else if (event.type === "payment.succeeded") {
      const p = event.data.payment;
      if (toMicro(p.amount) !== toMicro(order.total)) {
        entry.outcome = `Amount mismatch: paid ${p.amount}, expected ${order.total}. Not fulfilled.`;
      } else {
        if (order.status === "pending") order.status = "paid";
        order.paidAt ??= new Date().toISOString();
        order.fulfilledByEventId ??= event.id;
        order.payment = { id: p.id, txHash: p.txHash, explorerUrl: p.explorerUrl, payer: p.payer, amount: p.amount };
        entry.outcome = `Order ${orderId} marked paid & fulfilled`;
      }
    } else if (event.type === "refund.succeeded") {
      const { refund, payment } = event.data;
      if (!order.refunds.some((r) => r.id === refund.id)) {
        order.refunds.push({
          id: refund.id,
          amount: refund.amount,
          txHash: refund.txHash,
          explorerUrl: refund.explorerUrl,
          eventId: event.id,
          recordedAt: new Date().toISOString(),
        });
      }
      order.amountRefunded = payment.amountRefunded;
      if (payment.status === "refunded") order.status = "refunded";
      else if (payment.status === "partially_refunded") order.status = "partially_refunded";
      entry.outcome = `Refund ${refund.amount} USDT recorded for ${orderId}`;
    } else {
      entry.outcome = `Unhandled event type (ignored)`;
    }

    data.processedEventIds.push(event.id);
    log(data.webhookLog, entry);
    return entry.outcome;
  });

  console.log(`[webhook]   -> ${outcome}`);
  return Response.json({ received: true });
}

function log(list: WebhookLogEntry[], entry: WebhookLogEntry) {
  list.push(entry);
  if (list.length > MAX_LOG) list.splice(0, list.length - MAX_LOG);
}
