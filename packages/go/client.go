// Package whitechain provides a server-side client for Whitechain Commerce.
package whitechain

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Client sends requests to Whitechain Commerce and is safe for concurrent use.
type Client struct {
	apiBase   string
	secretKey string
	http      *http.Client
}

// NewClient takes the origin of the Whitechain Commerce instance, without /api/v1.
func NewClient(origin, secretKey string) (*Client, error) {
	u, err := url.Parse(origin)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Hostname() == "" ||
		u.User != nil || u.ForceQuery || u.RawQuery != "" || u.Fragment != "" ||
		(u.EscapedPath() != "" && u.EscapedPath() != "/") {
		return nil, fmt.Errorf("whitechain: expected an HTTP or HTTPS origin without /api/v1")
	}
	if !strings.HasPrefix(secretKey, "sk_") || len(secretKey) == 3 || strings.ContainsAny(secretKey, " \t\r\n") {
		return nil, fmt.Errorf("whitechain: expected a secret key starting with sk_")
	}
	return &Client{
		apiBase:   strings.TrimSuffix(u.String(), "/") + "/api/v1",
		secretKey: secretKey,
		http: &http.Client{
			Timeout: 30 * time.Second,
			CheckRedirect: func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}, nil
}

// APIError describes a non-success HTTP response.
type APIError struct {
	StatusCode int
	Type       string
	Message    string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("whitechain: HTTP %d: %s", e.StatusCode, e.Message)
}

// CreateCheckoutSession creates or reuses a checkout session for an order.
func (c *Client) CreateCheckoutSession(ctx context.Context, params CreateCheckoutSessionParams) (CheckoutSession, error) {
	var session CheckoutSession
	err := c.request(ctx, http.MethodPost, "/checkout_sessions", true, params, &session)
	return session, err
}

// GetCheckoutSession reads the public checkout session.
func (c *Client) GetCheckoutSession(ctx context.Context, id string) (PublicCheckoutSession, error) {
	var session PublicCheckoutSession
	err := c.request(ctx, http.MethodGet, "/checkout_sessions/"+url.PathEscape(id), false, nil, &session)
	return session, err
}

// GetPayment reads a payment by ID.
func (c *Client) GetPayment(ctx context.Context, id string) (Payment, error) {
	var payment Payment
	err := c.request(ctx, http.MethodGet, "/payments/"+url.PathEscape(id), true, nil, &payment)
	return payment, err
}

// ListPayments returns recent payments. A limit of zero uses the API default.
func (c *Client) ListPayments(ctx context.Context, limit int) ([]Payment, error) {
	path := "/payments"
	if limit != 0 {
		path += "?limit=" + strconv.Itoa(limit)
	}
	var response struct {
		Data []Payment `json:"data"`
	}
	err := c.request(ctx, http.MethodGet, path, true, nil, &response)
	return response.Data, err
}

// CreateRefund creates a pending refund request. Check ListRefunds before
// retrying an ambiguous failure because each successful call creates a refund.
func (c *Client) CreateRefund(ctx context.Context, params CreateRefundParams) (Refund, error) {
	var refund Refund
	err := c.request(ctx, http.MethodPost, "/refunds", true, params, &refund)
	return refund, err
}

// ListRefunds returns recent refunds, optionally filtered by payment ID.
func (c *Client) ListRefunds(ctx context.Context, paymentID string) ([]Refund, error) {
	path := "/refunds"
	if paymentID != "" {
		path += "?paymentId=" + url.QueryEscape(paymentID)
	}
	var response struct {
		Data []Refund `json:"data"`
	}
	err := c.request(ctx, http.MethodGet, path, true, nil, &response)
	return response.Data, err
}

func (c *Client) request(ctx context.Context, method, path string, auth bool, body, result any) error {
	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("whitechain: encode request: %w", err)
		}
		reader = bytes.NewReader(payload)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.apiBase+path, reader)
	if err != nil {
		return fmt.Errorf("whitechain: build request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	if auth {
		req.Header.Set("Authorization", "Bearer "+c.secretKey)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("whitechain: request failed: %w", err)
	}
	defer res.Body.Close()

	// The API returns at most 100 results in a list.
	const maxResponseSize = 4 << 20
	data, err := io.ReadAll(io.LimitReader(res.Body, maxResponseSize+1))
	if err != nil {
		return fmt.Errorf("whitechain: read response: %w", err)
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		var response struct {
			Error struct {
				Type    string `json:"type"`
				Message string `json:"message"`
			} `json:"error"`
		}
		if json.Unmarshal(data, &response) == nil && response.Error.Message != "" {
			return &APIError{res.StatusCode, response.Error.Type, response.Error.Message}
		}
		return &APIError{StatusCode: res.StatusCode, Message: http.StatusText(res.StatusCode)}
	}
	if len(data) > maxResponseSize {
		return fmt.Errorf("whitechain: response exceeded size limit")
	}
	if err := json.Unmarshal(data, result); err != nil {
		return fmt.Errorf("whitechain: decode response: %w", err)
	}
	return nil
}
