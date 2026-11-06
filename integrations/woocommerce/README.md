# Whitechain Commerce for WooCommerce

The gateway adds **Pay with USDT (testnet)** to Classic Checkout and Checkout Blocks. It uses WooCommerce order APIs, including on stores with High-Performance Order Storage enabled.

## Install and configure

1. Zip the `whitechain-commerce` directory and upload the ZIP under **Plugins → Add New → Upload Plugin**. Activate WooCommerce and Whitechain Commerce.
2. Set the store currency to USD. This test gateway charges 1 testnet USDT per USD, with no exchange-rate lookup.
3. In Whitechain Commerce, register a testnet payout wallet and create a test API key.
4. Open **WooCommerce → Settings → Payments → Whitechain Commerce**. Add the API key and copy the webhook URL shown there.
5. Add that URL as a webhook endpoint in the Whitechain dashboard. Paste its signing secret into the WooCommerce settings, enable the gateway, and save.

On checkout, the plugin uses the order's server-side total and stores the hosted session on the order. A verified settlement event with the same session, amount, and currency completes payment in WooCommerce. Returning to the order page has no effect on payment status. The gateway keeps the same session for an order, including after expiry, because an expired session can still settle onchain. Reconcile any late payment before creating a replacement order.

For self-hosting, set `WHITECHAIN_API_ORIGIN` in `wp-config.php`. If the WordPress server uses a private address to reach the API, set `WHITECHAIN_CHECKOUT_ORIGIN` to the browser-facing origin returned by Whitechain.

Refunds require the merchant payout wallet and can be initiated in the Whitechain dashboard. This gateway does not synchronize refund status back to WooCommerce.
