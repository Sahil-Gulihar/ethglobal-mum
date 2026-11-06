# Whitechain Commerce Python SDK

The server SDK runs on Python 3.10 or later with no runtime dependencies.

Install it in your merchant project's virtual environment:

```sh
python -m pip install whitechain-commerce
```

Create a session from an order your server has priced. Set `WC_API_BASE` to your Whitechain Commerce instance's origin and `WC_SECRET_KEY` to the merchant secret key.

```python
import os

from whitechain_commerce import Whitechain

client = Whitechain(
    api_base=os.environ["WC_API_BASE"],
    secret_key=os.environ["WC_SECRET_KEY"],
)
session = client.create_checkout_session(
    order_id="order_123",
    amount="49.99",
    success_url="https://store.example.com/orders/order_123",
    cancel_url="https://store.example.com/cart",
)
```

Store `session["id"]` with the order and redirect the shopper to `session["url"]`. Use a stable order ID and decimal strings for USDT amounts.

Verify webhooks against the raw request bytes before parsing or acting on them:

```python
from whitechain_commerce import SIGNATURE_HEADER, verify_webhook

event = verify_webhook(
    raw_body, headers.get(SIGNATURE_HEADER), os.environ["WC_WEBHOOK_SECRET"]
)
```

Check the webhook against your saved order and process each event ID once. The client also supports `list_payments()`, `get_payment()`, `create_refund()`, and `list_refunds()`. Refund requests need a wallet signature in the dashboard to move funds. `WhitechainApiError` exposes the HTTP `status` and API error `type`.
