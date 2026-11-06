import { readStore } from "@/lib/db";

export async function GET(_req: Request, ctx: RouteContext<"/api/orders/[id]">) {
  const { id } = await ctx.params;
  const data = await readStore();
  const order = data.orders[id];
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  const events = data.webhookLog.filter((e) => e.orderId === id);
  return Response.json({ order, events }, { headers: { "Cache-Control": "no-store" } });
}
