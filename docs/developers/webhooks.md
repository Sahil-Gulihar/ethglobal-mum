---
title: "Webhooks"
description: "Get a signed HTTP request on your server whenever a payment or refund is confirmed onchain."
---

Webhooks are how your backend learns that money has moved. Whitechain Commerce watches the `PaymentRouter` contract, checks each payment against the checkout session it belongs to, and then sends a `POST` request to every enabled endpoint you have added. Fulfil orders from these requests, not from the browser. The `onSuccess` callback of the [checkout widget](./checkout-widget.md) is a UI signal only.

## How it works

1. A customer pays, or your payout wallet signs a refund.
2. The indexer reads the `PaymentSettled` or `Refunded` event from the chain and runs the [settlement checks](./payments.md#settlement-checks).
3. In the same database transaction that records the payment or refund, an event is created with one pending delivery per enabled endpoint.
4. The delivery worker signs the event body and posts it to your URL. Failed attempts are retried on a fixed schedule.

Deliveries are sent by the worker (`pnpm worker`, which ticks every 4 seconds) or by `GET /api/cron/tick` called with `Authorization: Bearer $CRON_SECRET`. If neither is running, events queue up and nothing is sent. See [self-hosting](./self-hosting.md).

## Add an endpoint

1. In the dashboard, open **Webhooks**.
2. Enter the full URL of your handler, for example `https://your-store.com/api/webhooks/whitechain`, and click **Add endpoint**.
3. Click **Reveal** next to **Signing secret** and copy the value into your server's environment, for example `WC_WEBHOOK_SECRET`.

Rules for endpoints:

| Rule | Detail |
| --- | --- |
| Scheme | `http:` or `https:` only. Use `https:` for anything reachable from the internet. |
| Limit | Up to 10 endpoints per merchant account. |
| Events | Every endpoint receives every event type. There is no per-endpoint event filter. |
| Signing secret | One per endpoint, generated when you add it: `whsec_` followed by 32 characters from `0-9`, `a-z`, `A-Z`. The dashboard shows `whsec_…` plus the last 4 characters until you click **Reveal**. |
| Disable | **Disable** stops new deliveries to the endpoint. Events created while it is disabled are not queued for it, and pending retries to it fail with `Endpoint is disabled`. |
| Delete | **Delete** removes the endpoint and its delivery log. |
| URL checks | Checked when you add the endpoint and again before every delivery. See [URL restrictions](#url-restrictions). |

Endpoints are managed in the dashboard only. There is no API for them yet.

## Event types

| Type | Sent when | `data` |
| --- | --- | --- |
| `payment.succeeded` | A `PaymentSettled` event passed every settlement check and the checkout session moved to `paid`. Sent once per payment. | `{ payment }` |
| `refund.succeeded` | A `Refunded` event for one of your payments was recorded. Sent once per `Refunded` log, so each partial refund gets its own event. | `{ refund, payment }` |

These are the only two event types. There are no events for expired sessions, failed payments or pending refunds.

A refund sent straight to the contract from your payout wallet, without a refund request in the dashboard or API, still produces a `refund.succeeded` event. See [refunds](./refunds.md).

## The event object

Every request body is one JSON event object.

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Unique event id, `evt_` followed by 20 characters. Use it to deduplicate. |
| `type` | string | `payment.succeeded` or `refund.succeeded`. |
| `created` | integer | Unix time in seconds when the event was created. |
| `data` | object | `{ payment }` for `payment.succeeded`, `{ refund, payment }` for `refund.succeeded`. |

### Payment object

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Payment id, `pay_...`. |
| `sessionId` | string | Checkout session id, `cs_...`. |
| `orderId` | string | Your own order id, as passed when you created the checkout session. |
| `amount` | string | Amount paid in USDT, as a decimal string with at least 2 decimals, for example `"5.98"`. |
| `amountRefunded` | string | Total refunded so far, same format, for example `"0.00"`. |
| `currency` | string | Always `"USDT"`. |
| `status` | string | `succeeded`, `partially_refunded` or `refunded`. |
| `payer` | string | Wallet address that paid. |
| `txHash` | string | Hash of the payment transaction. |
| `explorerUrl` | string | Link to the payment transaction on the Whitechain explorer. |
| `chainId` | integer | Always `1874` (Whitechain Sepolia). |
| `chainPaymentId` | string | The onchain `paymentId` (bytes32 hex). See [smart contract](./smart-contract.md#ids). |
| `createdAt` | string | ISO 8601 time the payment was recorded. |

### Refund object

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Refund id, `re_...`. |
| `paymentId` | string | The payment this refund belongs to, `pay_...`. |
| `orderId` | string | Your own order id. |
| `amount` | string | Amount of this refund in USDT, decimal string. |
| `currency` | string | Always `"USDT"`. |
| `status` | string | `pending` or `succeeded`. Always `succeeded` in a `refund.succeeded` event. |
| `txHash` | string or null | Hash of the refund transaction. Set in webhook events. |
| `explorerUrl` | string or null | Link to the refund transaction. Set in webhook events. |
| `createdAt` | string | ISO 8601 time the refund record was created. For a refund requested first in the dashboard or API, this is the request time. |

In a `refund.succeeded` event, `payment` reflects the state after this refund: `amountRefunded` is the running total and `status` is `partially_refunded` or `refunded`.

All amounts are decimal strings, never floats. Compare them exactly, for example by converting to integer base units (USDT has 6 decimals).

### Example: `payment.succeeded`

This is the event from the first live testnet run (see the [README](https://github.com/Sahil-Gulihar/ethglobal-mum/blob/main/README.md#payment-and-refund-explorer-links)):

```json
{
  "id": "evt_yaEr7n0S3O0VCFU5Kt71",
  "data": {
    "payment": {
      "id": "pay_AYJK3KbvImp0XZxp3gM0",
      "payer": "0xd25e2d037A49F19EAe6d55396fa52f2D95B7f27e",
      "amount": "5.98",
      "status": "succeeded",
      "txHash": "0xebd1c99ae548a3e497084f92a3d41d1bb0a8a5f4b775a681ebccd715e3e05125",
      "chainId": 1874,
      "orderId": "order_c3956bc0f34ad6f6",
      "currency": "USDT",
      "createdAt": "2026-11-06T14:29:08.392Z",
      "sessionId": "cs_fQqtlPuXFH5iqScwzpnm",
      "explorerUrl": "https://explorer.testnet.whitechain.io/tx/0xebd1c99ae548a3e497084f92a3d41d1bb0a8a5f4b775a681ebccd715e3e05125",
      "amountRefunded": "0.00",
      "chainPaymentId": "0xf023343c687ea8a44a45aa484624ae2da28c009014941a13a4982ce083da4993"
    }
  },
  "type": "payment.succeeded",
  "created": 1793975348
}
```

### Example: `refund.succeeded`

The 2.00 USDT partial refund of the same payment:

```json
{
  "id": "evt_ADPY6o8lTZAbqeUh5QoU",
  "data": {
    "refund": {
      "id": "re_03ZNuZ1NYazyqcL3xIqi",
      "amount": "2.00",
      "status": "succeeded",
      "txHash": "0xe2fcbd3d4a23bbb35964def3f7509bd2883a167164b790733ff069ef5c1bab52",
      "orderId": "order_c3956bc0f34ad6f6",
      "currency": "USDT",
      "createdAt": "2026-11-06T14:29:46.435Z",
      "paymentId": "pay_AYJK3KbvImp0XZxp3gM0",
      "explorerUrl": "https://explorer.testnet.whitechain.io/tx/0xe2fcbd3d4a23bbb35964def3f7509bd2883a167164b790733ff069ef5c1bab52"
    },
    "payment": {
      "id": "pay_AYJK3KbvImp0XZxp3gM0",
      "payer": "0xd25e2d037A49F19EAe6d55396fa52f2D95B7f27e",
      "amount": "5.98",
      "status": "partially_refunded",
      "txHash": "0xebd1c99ae548a3e497084f92a3d41d1bb0a8a5f4b775a681ebccd715e3e05125",
      "chainId": 1874,
      "orderId": "order_c3956bc0f34ad6f6",
      "currency": "USDT",
      "createdAt": "2026-11-06T14:29:08.392Z",
      "sessionId": "cs_fQqtlPuXFH5iqScwzpnm",
      "explorerUrl": "https://explorer.testnet.whitechain.io/tx/0xebd1c99ae548a3e497084f92a3d41d1bb0a8a5f4b775a681ebccd715e3e05125",
      "amountRefunded": "2.00",
      "chainPaymentId": "0xf023343c687ea8a44a45aa484624ae2da28c009014941a13a4982ce083da4993"
    }
  },
  "type": "refund.succeeded",
  "created": 1793975407
}
```

The examples are pretty-printed. On the wire the body is compact JSON with no whitespace. Events are stored as Postgres `jsonb`, so keys arrive in the order shown above, not in a logical order. Don't depend on key order, and never re-serialize the body before verifying it.

## Request format

Every delivery is an HTTP `POST` with these headers:

| Header | Value |
| --- | --- |
| `Content-Type` | `application/json` |
| `WC-Signature` | `t=<unix seconds>,v1=<signature>` |
| `User-Agent` | `WhitechainCommerce-Webhooks/1.0` |

For example:

```http
POST /api/webhooks/whitechain HTTP/1.1
Content-Type: application/json
User-Agent: WhitechainCommerce-Webhooks/1.0
WC-Signature: t=1793975348,v1=<64 hex characters>

{"id":"evt_yaEr7n0S3O0VCFU5Kt71","data":{"payment":{...}},"type":"payment.succeeded","created":1793975348}
```

Redirects are not followed. A `3xx` response counts as a failed attempt.

## Verify signatures

Anyone can send a request to your URL, so check the signature before you trust a request.

| Part | Value |
| --- | --- |
| Algorithm | HMAC-SHA256 |
| Key | The endpoint's signing secret, the full `whsec_...` string, used as UTF-8 bytes |
| Signed string | `` `${t}.${rawBody}` ``: the `t` value from the header, a literal `.`, then the exact raw request body |
| `v1` | Lowercase hex digest, 64 characters |
| `t` | Unix time in seconds when this attempt was signed. Every attempt, including retries and redeliveries, is signed with a fresh `t`. |
| Tolerance | 300 seconds by default. Reject requests where `t` is more than 300 seconds from your clock, in either direction. |

A worked example you can use to test your own code. With the secret `whsec_exampleexampleexampleexample1234`, `t` = `1793975348` and the raw body `{"id":"evt_example","type":"payment.succeeded"}`, the signed string is:

```text
1793975348.{"id":"evt_example","type":"payment.succeeded"}
```

and the header is:

```text
WC-Signature: t=1793975348,v1=2969cd7b4e1840f6a11ae5a59ef36e6bbc7ee626bfc3411ad8dd049e3426983e
```

To verify:

1. Read the raw body as bytes or a string. Don't parse JSON first.
2. Split the `WC-Signature` header on `,` and each part on the first `=` to get `t` and `v1`.
3. Reject the request if `t` is outside the tolerance.
4. Compute HMAC-SHA256 of `` `${t}.${rawBody}` `` with your signing secret.
5. Compare your digest with `v1` using a constant-time comparison.
6. Only then parse the JSON.

### With `verifyWebhook` (Next.js)

`verifyWebhook` is exported from `@whitechain-commerce/react/server` (and from `@whitechain-commerce/core/webhooks`). It does steps 2 to 6 and returns the parsed event, or throws `WebhookSignatureError`.

```ts
verifyWebhook<T = WebhookEvent>(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000),
): T
```

| Error message | Cause |
| --- | --- |
| `Missing WC-Signature header` | No header, or an empty one. |
| `Malformed WC-Signature header` | `t` or `v1` is missing, or `t` isn't a non-zero number. |
| `Timestamp outside tolerance` | `t` is more than `toleranceSeconds` away from now. |
| `Signature mismatch` | The digest doesn't match. Usually a wrong secret or a modified body. |

A Next.js App Router handler. It uses `node:crypto`, so keep the route on the Node.js runtime (the default), not the Edge runtime.

```ts
// app/api/webhooks/whitechain/route.ts
import { verifyWebhook, WebhookSignatureError, type WebhookEvent } from "@whitechain-commerce/react/server";

export async function POST(req: Request) {
  // Read the raw body. The signature covers these exact bytes, so don't parse and re-serialize first.
  const rawBody = await req.text();

  let event: WebhookEvent;
  try {
    event = verifyWebhook(rawBody, req.headers.get("wc-signature"), process.env.WC_WEBHOOK_SECRET!);
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  // Deliveries are at least once: skip events you have already handled.
  if (await alreadyProcessed(event.id)) return Response.json({ received: true });

  switch (event.type) {
    case "payment.succeeded": {
      const { payment } = event.data;
      // Compare payment.amount with your own order total before you fulfil.
      await markOrderPaid(payment.orderId, payment);
      break;
    }
    case "refund.succeeded": {
      const { refund, payment } = event.data;
      await recordRefund(payment.orderId, refund, payment.status);
      break;
    }
  }

  await markProcessed(event.id);
  return Response.json({ received: true });
}
```

`alreadyProcessed`, `markProcessed`, `markOrderPaid` and `recordRefund` stand for your own database code. `WebhookEvent` is a discriminated union, so `event.data` is typed correctly inside each `case`.

The demo store has a complete handler at [`apps/demo-store/src/app/api/webhooks/whitechain/route.ts`](https://github.com/Sahil-Gulihar/ethglobal-mum/blob/main/apps/demo-store/src/app/api/webhooks/whitechain/route.ts). It checks the amount against the order total, dedupes on `event.id`, and never moves a refunded total backwards.

The `@whitechain-commerce/*` packages are private workspace packages in this repository and are not published to npm. If you can't use them, use the dependency-free version below.

### Without dependencies (Node.js `crypto`)

A plain Node.js server that verifies the signature with `node:crypto` only:

```js
// server.mjs: run with `WC_WEBHOOK_SECRET=whsec_... node server.mjs`
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.WC_WEBHOOK_SECRET; // whsec_...
const TOLERANCE_SECONDS = 300;
const processed = new Set(); // use a database table with a unique key in production

/** Returns true if `header` is a valid WC-Signature for `rawBody` (a Buffer). */
function verifySignature(rawBody, header, secret, toleranceSeconds = TOLERANCE_SECONDS) {
  if (!header) return false;
  const parts = {};
  for (const item of header.split(",")) {
    const i = item.indexOf("=");
    if (i > 0) parts[item.slice(0, i).trim()] = item.slice(i + 1).trim();
  }
  const t = Number(parts.t);
  if (!Number.isInteger(t) || t <= 0 || !parts.v1) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - t) > toleranceSeconds) return false;

  // signed string = `${t}.${rawBody}`
  const expected = createHmac("sha256", secret).update(`${t}.`).update(rawBody).digest();
  const received = Buffer.from(parts.v1, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/webhooks/whitechain") {
    res.writeHead(404).end();
    return;
  }
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const rawBody = Buffer.concat(chunks);
    if (!verifySignature(rawBody, req.headers["wc-signature"], SECRET)) {
      res.writeHead(400, { "Content-Type": "application/json" }).end('{"error":"invalid signature"}');
      return;
    }
    const event = JSON.parse(rawBody.toString("utf8"));
    if (!processed.has(event.id)) {
      processed.add(event.id);
      console.log(`received ${event.type} ${event.id}`);
      // Fulfil or update the order here, or queue the work and return right away.
    }
    res.writeHead(200, { "Content-Type": "application/json" }).end('{"received":true}');
  });
}).listen(4242, () => console.log("listening on http://localhost:4242/webhooks/whitechain"));
```

`timingSafeEqual` throws if the two buffers have different lengths, so the length check comes first. A `v1` that isn't valid hex decodes to a shorter buffer and fails that check.

## Respond and retry

Your endpoint has 10 seconds to answer. Any `2xx` status counts as delivered. Anything else is a failed attempt: a non-`2xx` status (including `3xx`), a timeout, or a network error.

| Attempt | When |
| --- | --- |
| 1 | As soon as the worker picks up the event (the worker ticks every 4 seconds) |
| 2 | 1 minute after attempt 1 fails |
| 3 | 5 minutes after attempt 2 fails |
| 4 | 30 minutes after attempt 3 fails |

After the 4th failed attempt the delivery is marked `failed` and is not retried again. You can still [redeliver](#redeliver-and-test-events) it from the dashboard.

Some failures are final straight away, with no retries:

- The endpoint is disabled (`Endpoint is disabled`).
- The URL fails the [URL restrictions](#url-restrictions) at send time (`Blocked: <reason>`). This includes a hostname that doesn't resolve.
- The event is a test event.

The response body is stored in the delivery log, truncated to 1 KB. Its content doesn't affect the outcome.

## Idempotency and ordering

Delivery is at least once. The same event can arrive more than once, for example after a timeout where your server did process the request, or after a manual redeliver. Every copy carries the same `id` and the same body; only the `t` and `v1` in the header change.

- Store the `id` of each event you process, with a unique constraint, and skip events you have already seen.
- Don't assume events arrive in order. A retried `payment.succeeded` can arrive after a `refund.succeeded` for the same payment, and two partial refunds can arrive in either order. Use `payment.amountRefunded` and `payment.status` as a running total and never move them backwards.
- Each endpoint gets its own delivery of each event, with its own retry schedule.

## Delivery log

**Webhooks → Recent deliveries** in the dashboard lists the last 50 deliveries across all your endpoints, newest first.

| Column | Meaning |
| --- | --- |
| Event | Event type and endpoint URL. Test events have a **Test** badge. |
| Status | **Retrying** (`pending`), **Delivered** (`succeeded`) or **Failed** (`failed`). |
| Attempts | Number of attempts so far. |
| Last response | HTTP status of the last attempt, or `error` if there was no response. |
| Next retry | When the next attempt is due, for retrying deliveries. |
| Created | When the delivery was created. |

Expand a row to see the event id (`evt_...`), the delivery id (`whd_...`), and every attempt with its status code, duration, time, error message and response body. While any delivery is retrying, the page refreshes every 10 seconds.

## Redeliver and test events

**Redeliver** (on each delivery row) sends the same event to the same endpoint right away. It works on delivered and failed deliveries too. The attempt counter is reset first, so if the redelivery fails it gets the full retry schedule again.

**Send test event** (on each enabled endpoint) sends a synthetic `payment.succeeded` event to that one endpoint right away and shows the result. It's signed with the endpoint's real secret, so it's a good way to check your verification code. The test payment has these values:

| Field | Value |
| --- | --- |
| `id` | `pay_test_` followed by a millisecond timestamp |
| `sessionId` | `cs_test` |
| `orderId` | `test_order` |
| `amount` | `"1.00"` |
| `amountRefunded` | `"0.00"` |
| `status` | `succeeded` |
| `payer` | `0x000000000000000000000000000000000000dEaD` |
| `txHash` | `0x` followed by 63 zeros and a `1` |
| `explorerUrl` | `""` (empty string) |
| `chainPaymentId` | `0x` followed by 64 zeros |

Test events are not retried. Treat any payment whose `id` starts with `pay_test_` as a test and don't fulfil anything for it. Your handler will usually see `test_order` as an unknown order, which is fine; still return `2xx`.

There is no test event for `refund.succeeded`. To exercise refunds, make a real testnet payment and refund it. See [testing](./testing.md).

## URL restrictions

To stop endpoints from being pointed at internal services, webhook URLs are checked when you add them and again before every delivery.

In production (`NODE_ENV=production`), a URL is rejected if:

- the hostname is `localhost`, or ends in `.localhost`, `.internal` or `.local`, or
- it doesn't resolve, or any address it resolves to is in a blocked range.

| Family | Blocked ranges |
| --- | --- |
| IPv4 | `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.0.0.0/24`, `192.0.2.0/24`, `192.168.0.0/16`, `198.18.0.0/15`, `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`, `240.0.0.0/4` |
| IPv6 | `::/128`, `::1/128`, `::ffff:0:0/96`, `64:ff9b::/96`, `100::/64`, `2001:db8::/32`, `fc00::/7`, `fe80::/10`, `ff00::/8` |

Outside production, or when `ALLOW_PRIVATE_WEBHOOK_URLS=true` is set, these checks are skipped so you can use local URLs such as the demo store's `http://localhost:3001/api/webhooks/whitechain`. Only the `http:`/`https:` scheme check always applies.

Both variables are read by the process that runs the check: the dashboard when you add an endpoint, send a test event or redeliver, and the worker (or the dashboard, for `/api/cron/tick`) before a scheduled delivery. `next start` sets `NODE_ENV=production` for the dashboard, but `pnpm worker` doesn't set it, so set `NODE_ENV=production` in the worker's environment too if you want the checks applied there.

To receive webhooks on your laptop from a production deployment, expose your local server through a public HTTPS tunnel and add the tunnel URL as the endpoint.

## Best practices

- **Verify before you parse.** Check the signature on the raw body first, and reject failures with `400`.
- **Return `2xx` fast.** You have 10 seconds. Record the event and return, then do slow work (emails, fulfilment APIs) in a background job.
- **Fulfil from webhooks.** Mark orders paid only from a verified `payment.succeeded`, never from the browser callback or the success redirect.
- **Check the amount.** Compare `payment.amount` with your own order total before you ship. The platform already checks it against the checkout session, and checking again guards against bugs on your side.
- **Deduplicate on `event.id`.** Process each event once, even if it arrives several times.
- **Use status codes on purpose.** Every non-`2xx` response is retried, whatever the code. Return `5xx` for your own temporary failures (database down, secret not configured) so a later retry can succeed, and `400` for a bad signature. Return `2xx` for events you understand but choose to ignore, such as unknown orders or test events, so they aren't retried.
- **Keep the secret secret.** Store `whsec_...` in an environment variable, never in client code. There's no rotation yet; to change a secret, add a new endpoint, move your server to its secret, then delete the old endpoint.
- **Check onchain if you want to.** Every payment carries `txHash` and `chainPaymentId`, so you can confirm it on the chain yourself. See [verify a payment onchain](./smart-contract.md#verify-a-payment-onchain).

## Limitations

- Two event types only: `payment.succeeded` and `refund.succeeded`.
- No per-endpoint event filtering, no API to manage endpoints or list events, and no secret rotation.
- No test event for `refund.succeeded`.
- No ordering guarantee between events.
- Testnet only (Whitechain Sepolia, chain `1874`). There is no live mode.

## Related

- [Payments](./payments.md): the payment object and how payments are confirmed
- [Refunds](./refunds.md): full and partial refunds signed by your payout wallet
- [Smart contract](./smart-contract.md): the events behind each webhook
- [Testing](./testing.md): test events and testnet funds
