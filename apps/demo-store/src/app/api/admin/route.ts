import { readStore } from "@/lib/db";

export async function GET() {
  const data = await readStore();
  const orders = Object.values(data.orders).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const events = [...data.webhookLog].reverse();
  return Response.json({ orders, events }, { headers: { "Cache-Control": "no-store" } });
}
