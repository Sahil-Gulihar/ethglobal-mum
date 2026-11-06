package whitechain

// CreateCheckoutSessionParams contains the merchant order data for USDT checkout.
type CreateCheckoutSessionParams struct {
	OrderID    string            `json:"orderId"`
	Amount     string            `json:"amount"`
	SuccessURL string            `json:"successUrl,omitempty"`
	CancelURL  string            `json:"cancelUrl,omitempty"`
	Metadata   map[string]string `json:"metadata,omitempty"`
}

// PublicCheckoutSession is the public view of a checkout session.
type PublicCheckoutSession struct {
	ID       string `json:"id"`
	Status   string `json:"status"`
	Merchant struct {
		Name string `json:"name"`
	} `json:"merchant"`
	OrderID         string          `json:"orderId"`
	Amount          string          `json:"amount"`
	AmountUnits     string          `json:"amountUnits"`
	Currency        string          `json:"currency"`
	Decimals        int             `json:"decimals"`
	ChainID         int             `json:"chainId"`
	RouterAddress   string          `json:"routerAddress"`
	TokenAddress    string          `json:"tokenAddress"`
	ChainMerchantID string          `json:"chainMerchantId"`
	ChainOrderID    string          `json:"chainOrderId"`
	ExpiresAt       string          `json:"expiresAt"`
	SuccessURL      *string         `json:"successUrl"`
	CancelURL       *string         `json:"cancelUrl"`
	Payment         *SessionPayment `json:"payment"`
}

// SessionPayment contains the public payment details for a paid checkout.
type SessionPayment struct {
	ID          string `json:"id"`
	TxHash      string `json:"txHash"`
	ExplorerURL string `json:"explorerUrl"`
}

// CheckoutSession includes the hosted URL and merchant metadata.
type CheckoutSession struct {
	PublicCheckoutSession
	URL       string            `json:"url"`
	Metadata  map[string]string `json:"metadata"`
	CreatedAt string            `json:"createdAt"`
}

// Payment describes a confirmed payment.
type Payment struct {
	ID             string `json:"id"`
	SessionID      string `json:"sessionId"`
	OrderID        string `json:"orderId"`
	Amount         string `json:"amount"`
	AmountRefunded string `json:"amountRefunded"`
	Currency       string `json:"currency"`
	Status         string `json:"status"`
	Payer          string `json:"payer"`
	TxHash         string `json:"txHash"`
	ExplorerURL    string `json:"explorerUrl"`
	ChainID        int    `json:"chainId"`
	ChainPaymentID string `json:"chainPaymentId"`
	CreatedAt      string `json:"createdAt"`
}

// CreateRefundParams contains the payment ID and decimal USDT refund amount.
type CreateRefundParams struct {
	PaymentID string `json:"paymentId"`
	Amount    string `json:"amount"`
}

// Refund describes a pending or confirmed refund.
type Refund struct {
	ID          string  `json:"id"`
	PaymentID   string  `json:"paymentId"`
	OrderID     string  `json:"orderId"`
	Amount      string  `json:"amount"`
	Currency    string  `json:"currency"`
	Status      string  `json:"status"`
	TxHash      *string `json:"txHash"`
	ExplorerURL *string `json:"explorerUrl"`
	CreatedAt   string  `json:"createdAt"`
}
