import { OrderStatusView } from "./order-status";

export default async function OrderPage({ params, searchParams }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const { paid } = await searchParams;
  // ?paid=1 is set by the widget's onSuccess redirect: the customer has paid, the webhook is on its way.
  return <OrderStatusView orderId={id} justPaid={paid === "1"} />;
}
