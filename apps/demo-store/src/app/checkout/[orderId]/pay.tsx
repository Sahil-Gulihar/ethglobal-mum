"use client";

import { useRouter } from "next/navigation";
import { WhitechainCheckout } from "@whitechain-commerce/react";

export function Pay({ orderId, sessionId }: { orderId: string; sessionId: string }) {
  const router = useRouter();

  return (
    <WhitechainCheckout
      sessionId={sessionId}
      theme="dark"
      apiBase={process.env.NEXT_PUBLIC_WC_API_BASE ?? "http://localhost:3000"}
      onSuccess={() => router.push(`/orders/${orderId}?paid=1`)}
      onError={(e) => console.error("Checkout error", e)}
    />
  );
}
