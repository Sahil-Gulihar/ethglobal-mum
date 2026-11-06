package whitechain

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// SignatureHeader is the HTTP header carrying the timestamp and HMAC.
const SignatureHeader = "WC-Signature"

// WebhookEvent contains a verified payment or refund notification.
type WebhookEvent struct {
	ID      string      `json:"id"`
	Type    string      `json:"type"`
	Created int64       `json:"created"`
	Data    WebhookData `json:"data"`
}

// WebhookData contains the associated payment and optional refund.
type WebhookData struct {
	Payment *Payment `json:"payment"`
	Refund  *Refund  `json:"refund"`
}

// VerifyWebhook authenticates the original body bytes before decoding JSON.
// The signature timestamp must be within five minutes of the current time.
func VerifyWebhook(rawBody []byte, signature, secret string) (WebhookEvent, error) {
	var event WebhookEvent
	if secret == "" {
		return event, errors.New("whitechain: webhook signing secret is required")
	}
	if signature == "" {
		return event, errors.New("whitechain: missing WC-Signature header")
	}
	var timestamp, digest string
	var hasTimestamp, hasDigest bool
	for _, part := range strings.Split(signature, ",") {
		key, value, _ := strings.Cut(strings.TrimSpace(part), "=")
		switch key {
		case "t":
			if hasTimestamp {
				return event, errors.New("whitechain: duplicate signature timestamp")
			}
			timestamp, hasTimestamp = value, true
		case "v1":
			if hasDigest {
				return event, errors.New("whitechain: duplicate v1 signature")
			}
			digest, hasDigest = value, true
		}
	}
	t, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil || t <= 0 || strconv.FormatInt(t, 10) != timestamp || len(digest) != sha256.Size*2 {
		return event, errors.New("whitechain: malformed WC-Signature header")
	}
	now := time.Now().Unix()
	if t < now-300 || t > now+300 {
		return event, errors.New("whitechain: signature timestamp outside tolerance")
	}
	received, err := hex.DecodeString(digest)
	if err != nil {
		return event, errors.New("whitechain: malformed webhook signature")
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "."))
	mac.Write(rawBody)
	if !hmac.Equal(mac.Sum(nil), received) {
		return event, errors.New("whitechain: webhook signature mismatch")
	}
	if err := json.Unmarshal(rawBody, &event); err != nil {
		return WebhookEvent{}, fmt.Errorf("whitechain: decode webhook event: %w", err)
	}
	return event, nil
}
