import { OrderStatusView } from "./order-status";

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  return <OrderStatusView orderId={id} />;
}
