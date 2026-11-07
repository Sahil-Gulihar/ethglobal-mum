import { createCheckoutSession } from "@whitechain-commerce/react/server";
import { formatUsdt, getProduct } from "@/lib/catalog";
import { newOrderId, updateStore } from "@/lib/db";
import { STORE_URL, WC_API_BASE, requireEnv } from "@/lib/env";
import type { Order, OrderItem } from "@/lib/types";

export async function POST(req: Request) {
  let body: { items?: { productId?: unknown; quantity?: unknown }[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const items: OrderItem[] = [];
  for (const line of body.items ?? []) {
    const product = typeof line.productId === "string" ? getProduct(line.productId) : undefined;
    const quantity = Number(line.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return Response.json({ error: "Invalid cart item" }, { status: 400 });
    }
    items.push({ productId: product.id, name: product.name, unitPriceCents: product.priceCents, quantity });
  }
  if (items.length === 0) return Response.json({ error: "Cart is empty" }, { status: 400 });

  const totalCents = items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
  const orderId = newOrderId();
  const total = formatUsdt(totalCents);

  let session;
  try {
    session = await createCheckoutSession({
      apiBase: WC_API_BASE,
      secretKey: requireEnv("WC_SECRET_KEY"),
      orderId,
      amount: total,
      successUrl: `${STORE_URL}/orders/${orderId}`,
      cancelUrl: `${STORE_URL}/`,
      metadata: { store: "chai-and-co", items: String(items.length) },
      // Verified buyers: shoppers prove they're human with World ID before they can pay.
      requireVerifiedBuyer: true,
    });
  } catch (err) {
    console.error("[orders] createCheckoutSession failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not create checkout session" },
      { status: 502 },
    );
  }

  const order: Order = {
    id: orderId,
    items,
    totalCents,
    total,
    status: "pending",
    sessionId: session.id,
    checkoutUrl: session.url ?? null,
    createdAt: new Date().toISOString(),
    paidAt: null,
    fulfilledByEventId: null,
    payment: null,
    amountRefunded: "0.00",
    refunds: [],
  };
  await updateStore((data) => {
    data.orders[orderId] = order;
  });
  console.log(`[orders] created ${orderId} total=${total} USDT session=${session.id}`);

  return Response.json({ orderId, sessionId: session.id }, { status: 201 });
}
