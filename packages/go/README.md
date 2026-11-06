# Whitechain Commerce for Go

Use Go 1.23 or later. The SDK uses the Go standard library.

## Install

Run this in your merchant module:

```sh
go get github.com/Sahil-Gulihar/ethglobal-mum/packages/go@v0.1.0
```

## Create a hosted checkout

Configure `WC_API_BASE` with the HTTPS origin for your Whitechain Commerce instance and `WC_SECRET_KEY` with the merchant's secret key. Read the order ID and decimal USDT amount from your own order data.

```go
import (
    "net/http"
    "os"

    whitechain "github.com/Sahil-Gulihar/ethglobal-mum/packages/go"
)

func redirectToCheckout(w http.ResponseWriter, r *http.Request, orderID, amount string) {
    client, err := whitechain.NewClient(os.Getenv("WC_API_BASE"), os.Getenv("WC_SECRET_KEY"))
    if err != nil {
        http.Error(w, "Checkout unavailable", http.StatusInternalServerError)
        return
    }

    session, err := client.CreateCheckoutSession(r.Context(), whitechain.CreateCheckoutSessionParams{
        OrderID: orderID,
        Amount:  amount,
    })
    if err != nil {
        http.Error(w, "Could not start checkout", http.StatusBadGateway)
        return
    }

    // Save session.ID to the order before redirecting the shopper.
    http.Redirect(w, r, session.URL, http.StatusSeeOther)
}
```

Use `GetCheckoutSession` for checkout status, `GetPayment` or `ListPayments` to reconcile payments, and `CreateRefund` or `ListRefunds` to manage refund requests. A created refund is pending until the merchant signs the refund in the dashboard and the transaction is confirmed. Check existing refunds before retrying an ambiguous creation failure. The API returns an `*APIError` with a status code, error type, and message for unsuccessful HTTP responses.

## Verify a webhook

Read the original request body with a size limit, then call `whitechain.VerifyWebhook(rawBody, r.Header.Get(whitechain.SignatureHeader), signingSecret)`. Store the signing secret on your server. After verifying the signature, match the payment to the stored order and session and deduplicate deliveries by event ID before fulfilling. The return URL only navigates the shopper back to your store.
