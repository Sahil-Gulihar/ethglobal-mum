---
title: "Test your integration"
description: "Test checkout, verify signed webhooks, and confirm that your store marks the right order paid."
---

Whitechain Commerce runs on Whitechain Sepolia (chain id `1874`) only. There is no live mode: every secret key is `sk_test_`, and every payment uses testnet USDT with no real value.

## Network details

| | |
| --- | --- |
| Network | Whitechain Sepolia, chain id `1874` (`0x752`) |
| Gas token | WBT (18 decimals) |
| Public RPC | `https://rpc.testnet.whitechain.io` |
| Explorer | https://explorer.testnet.whitechain.io |
| Faucet | https://faucet.testnet.whitechain.io |
| USDT | [`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`](https://explorer.testnet.whitechain.io/token/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7), 6 decimals |
| PaymentRouter | [`0xa99a6D97607567f4fe734831910D24f4e9BD0508`](https://explorer.testnet.whitechain.io/address/0xa99a6D97607567f4fe734831910D24f4e9BD0508) |

Use `rpc.testnet.whitechain.io` with a dot. `rpc-testnet.whitechain.io` with a hyphen returns chain id 2625, which is a different network.

## Get testnet funds

A test customer needs USDT to pay and WBT for gas. A merchant payout wallet needs WBT for gas to approve and send refunds, and USDT to refund with.

### WBT

Claim WBT from the faucet at https://faucet.testnet.whitechain.io. The faucet sets its own eligibility rules and claim limits, which this project doesn't control or document. The checkout widget links to the same faucet when a customer's wallet is short of WBT or USDT.

### USDT

The wallet for our first live run got its testnet USDT by swapping WBT for USDT in the YetiTrade testnet pool: [swap transaction](https://explorer.testnet.whitechain.io/tx/0x1c12f7c1b1d372147975f03f11d10b1a1be46bc5ed2177ac7055c121b3b5ddd6).

Make sure you receive the official USDT at `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`. The router only accepts that token, and the indexer ignores payments in any other token.

To see USDT in your wallet, add it as a custom token with that address, symbol `USDT` and 6 decimals.

## Verify webhook delivery

Register your store's public HTTPS endpoint under **Webhooks**. Choose **Send test event** to check that the endpoint receives a signed request and returns a `2xx`. The synthetic event uses order ID `test_order` and a payment ID starting with `pay_test_`. It should never trigger fulfilment. Check the status in the dashboard delivery log.

## Run a test order

1. Start a test order in your store and choose the USDT payment option. Check that the hosted checkout shows your business name and the expected total.
2. Connect the funded test customer wallet, approve USDT if prompted, and pay. Check that the customer returns to your order page.
3. Confirm that **Payments** shows the payment and links to its transaction. In **Webhooks**, confirm delivery of `payment.succeeded` and check that your store marks the matching order paid.
4. Use **Redeliver** on the webhook and confirm the same event cannot fulfil the order twice.
5. If you support refunds, issue a [full or partial refund](./refunds.md) from your payout wallet and verify that your store handles `refund.succeeded`.

To test [payment links](./payment-links.md), open your link with the test customer wallet, pay, and verify the payment and the link's updated count in the dashboard.
