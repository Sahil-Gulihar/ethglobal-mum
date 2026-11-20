import hmac
import json
import re
import time
from typing import Any

SIGNATURE_HEADER = "WC-Signature"


class WebhookSignatureError(ValueError):
    pass


def verify_webhook(
    raw_body: bytes,
    signature: str | None,
    secret: str,
    *,
    tolerance_seconds: int = 300,
) -> dict[str, Any]:
    """Verify the unmodified request bytes before decoding the event."""
    if not signature:
        raise WebhookSignatureError("Missing WC-Signature header")
    if not secret:
        raise WebhookSignatureError("Missing webhook signing secret")
    parts = {}
    for part in signature.split(","):
        key, separator, value = part.strip().partition("=")
        if key in parts or not separator:
            raise WebhookSignatureError("Malformed WC-Signature header")
        parts[key] = value

    timestamp = parts.get("t", "")
    digest = parts.get("v1", "")
    if not re.fullmatch(r"[1-9][0-9]{0,18}", timestamp) or not re.fullmatch(
        r"[0-9a-fA-F]{64}", digest
    ):
        raise WebhookSignatureError("Malformed WC-Signature header")
    if abs(int(time.time()) - int(timestamp)) > tolerance_seconds:
        raise WebhookSignatureError("Timestamp outside tolerance")
    expected = hmac.digest(
        secret.encode("utf-8"), timestamp.encode("ascii") + b"." + raw_body, "sha256"
    )
    if not hmac.compare_digest(expected, bytes.fromhex(digest)):
        raise WebhookSignatureError("Signature mismatch")

    event = json.loads(raw_body)
    if not isinstance(event, dict):
        raise TypeError("Expected a webhook event object")
    return event
