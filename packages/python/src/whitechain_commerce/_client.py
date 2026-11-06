import json
from typing import Any, cast
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from ._types import CheckoutSession, Payment, Refund


class WhitechainApiError(Exception):
    def __init__(self, message: str, status: int, error_type: str) -> None:
        super().__init__(message)
        self.status = status
        self.type = error_type


class _NoRedirects(HTTPRedirectHandler):
    # urllib can carry Authorization into redirect requests.
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Whitechain:
    """Use the origin of a Whitechain Commerce instance and a server-side secret key."""

    def __init__(self, *, api_base: str, secret_key: str, timeout: float = 10) -> None:
        url = urlsplit(api_base)
        if (
            url.scheme not in ("http", "https")
            or not url.hostname
            or url.username is not None
            or url.path not in ("", "/")
            or url.query
            or url.fragment
        ):
            raise ValueError("api_base must be an HTTP(S) origin, without /api/v1")
        if not secret_key.startswith("sk_"):
            raise ValueError("secret_key must start with sk_")
        self._base = api_base.rstrip("/") + "/api/v1"
        self._secret_key = secret_key
        self._timeout = timeout
        self._opener = build_opener(_NoRedirects())

    def create_checkout_session(
        self,
        *,
        order_id: str,
        amount: str,
        success_url: str | None = None,
        cancel_url: str | None = None,
        metadata: dict[str, str] | None = None,
    ) -> CheckoutSession:
        """Create or reuse a payable session for an order. Amounts are decimal strings."""
        payload = {
            "orderId": order_id,
            "amount": amount,
            "currency": "USDT",
            "successUrl": success_url,
            "cancelUrl": cancel_url,
            "metadata": metadata,
        }
        return cast(
            CheckoutSession,
            self._request(
                "/checkout_sessions",
                {k: v for k, v in payload.items() if v is not None},
            ),
        )

    def list_payments(self, *, limit: int | None = None) -> list[Payment]:
        path = (
            "/payments" if limit is None else "/payments?" + urlencode({"limit": limit})
        )
        return cast(list[Payment], self._request(path)["data"])

    def get_payment(self, payment_id: str) -> Payment:
        return cast(Payment, self._request("/payments/" + quote(payment_id, safe="")))

    def create_refund(self, *, payment_id: str, amount: str) -> Refund:
        """Request a pending refund for the merchant to sign in the dashboard."""
        return cast(
            Refund,
            self._request("/refunds", {"paymentId": payment_id, "amount": amount}),
        )

    def list_refunds(self, *, payment_id: str | None = None) -> list[Refund]:
        path = (
            "/refunds"
            if payment_id is None
            else "/refunds?" + urlencode({"paymentId": payment_id})
        )
        return cast(list[Refund], self._request(path)["data"])

    def _request(
        self, path: str, payload: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self._secret_key}",
            "Accept": "application/json",
        }
        if payload is not None:
            headers["Content-Type"] = "application/json"
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        request = Request(self._base + path, data=body, headers=headers)
        try:
            try:
                response = self._opener.open(request, timeout=self._timeout)
            except HTTPError as error:
                response = error
            with response:
                status = response.status
                data = response.read()
        except (URLError, OSError) as error:
            raise WhitechainApiError(
                "Could not reach Whitechain Commerce", 0, "network_error"
            ) from error

        try:
            result = json.loads(data)
        except ValueError:
            result = None

        if not 200 <= status < 300:
            details = result.get("error") if isinstance(result, dict) else None
            if (
                isinstance(details, dict)
                and isinstance(details.get("message"), str)
                and isinstance(details.get("type"), str)
            ):
                raise WhitechainApiError(details["message"], status, details["type"])
            raise WhitechainApiError(
                f"Whitechain Commerce API returned HTTP {status}",
                status,
                "server_error",
            )
        if not isinstance(result, dict):
            raise WhitechainApiError(
                "Expected a JSON object from Whitechain Commerce",
                status,
                "server_error",
            )
        return result
