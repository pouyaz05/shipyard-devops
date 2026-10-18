import uuid
from dataclasses import dataclass
from functools import lru_cache

import httpx

from app.clients.errors import UpstreamUnavailable
from app.core.config import settings


@dataclass(frozen=True)
class CartLine:
    product_id: uuid.UUID
    product_name: str
    unit_price_cents: int
    quantity: int


class CartClient:
    def __init__(
        self,
        base_url: str,
        timeout: float = 3.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"), timeout=timeout, transport=transport
        )

    def get_cart(self, token: str) -> list[CartLine]:
        response = self._request("GET", token)
        if response.status_code != 200:
            raise UpstreamUnavailable(f"cart-service returned {response.status_code}")
        try:
            return [
                CartLine(
                    product_id=uuid.UUID(item["product_id"]),
                    product_name=item["product_name"],
                    unit_price_cents=int(item["unit_price_cents"]),
                    quantity=int(item["quantity"]),
                )
                for item in response.json()["items"]
            ]
        except (ValueError, KeyError, TypeError):
            raise UpstreamUnavailable("invalid response from cart-service") from None

    def clear_cart(self, token: str) -> None:
        response = self._request("DELETE", token)
        if response.status_code not in (200, 204):
            raise UpstreamUnavailable(f"cart-service returned {response.status_code}")

    def _request(self, method: str, token: str) -> httpx.Response:
        try:
            return self._client.request(
                method, "/api/cart-service/cart", headers={"Authorization": f"Bearer {token}"}
            )
        except httpx.HTTPError:  # timeouts, connection errors, ...
            raise UpstreamUnavailable("cart-service is unreachable") from None


@lru_cache
def get_cart_client() -> CartClient:
    return CartClient(settings.CART_SERVICE_URL)
