/** Integration snippets shown on the landing page and in the dashboard. */
export function clientSnippet() {
  return `import { WhitechainCheckout } from "@whitechain-commerce/react";

export default function Checkout({ sessionId }: { sessionId: string }) {
  return (
    <WhitechainCheckout
      sessionId={sessionId}
      onSuccess={(payment) => {
        // UI only. Fulfil the order from the webhook.
        window.location.href = \`/orders/\${payment.orderId}\`;
      }}
      onError={(error) => console.error(error)}
    />
  );
}`;
}

export function serverSnippet(apiBase: string) {
  return `const res = await fetch("${apiBase}/api/v1/checkout_sessions", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.WC_SECRET_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ orderId: "order_456", amount: "49.99", currency: "USDT" }),
});
const { id: sessionId } = await res.json();`;
}

export function webhookSnippet() {
  return `import { verifyWebhook } from "@whitechain-commerce/react/server";

export async function POST(req: Request) {
  const body = await req.text();
  const event = verifyWebhook(body, req.headers.get("wc-signature"), process.env.WC_WEBHOOK_SECRET!);
  if (event.type === "payment.succeeded") {
    // mark event.data.payment.orderId as paid (dedupe on event.id)
  }
  return new Response("ok");
}`;
}
