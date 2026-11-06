---
title: "Payment links"
description: "Share a fixed-price USDT checkout from the dashboard without writing code."
---

Use a payment link for a fixed-price item or a payment you reconcile by hand. Share it in a message, invoice, or button on your site. For carts with different totals or orders that your store fulfils automatically, use the [store integration quickstart](./quickstart.md).

## Create and share a link

1. [Create a merchant account](https://100lana.com/signup) and register your payout wallet in the dashboard.
2. Open **Payment links** and select **Create payment link**.
3. Enter a name and a USDT amount, create the link, and copy it.

The same link can accept multiple payments. Each visit starts a fresh checkout for the fixed amount. Customers need a wallet with testnet USDT and WBT for gas. The USDT goes directly to your payout wallet.

## Track payments

Review the link's payment count and total under **Payment links**. Open **Payments** to confirm individual payments and see their on-chain transaction details. Disable a link from **Payment links** when you want to stop new checkouts.

Payment links do not carry your store's order ID. If you need to match each payment automatically to an existing order, create a separate [checkout session](./checkout-sessions.md) from your server.
