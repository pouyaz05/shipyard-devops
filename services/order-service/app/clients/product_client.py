import uuid
from dataclasses import dataclass
from functools import lru_cache

import httpx

from app.clients.errors import InsufficientStock, ProductNotFound, UpstreamUnavailable
from app.core.config import settings


@dataclass(frozen=True)
class ProductInfo:
    id: uuid.UUID
    name: str
    price_cents: int
    stock: int


class ProductClient:
    def __init__(
        self,
        base_url: str,
        internal_key: str,
        timeout: float = 3.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"), timeout=timeout, transport=transport
        )
        self._internal_headers = {"X-Internal-Key": internal_key}

    def get_product(self, product_id: uuid.UUID) -> ProductInfo:
        try:
            response = self._client.get(f"/api/product-service/products/by-id/{product_id}")
        except httpx.HTTPError:  # timeouts, connection errors, ...
            raise UpstreamUnavailable("product-service is unreachable") from None
        if response.status_code == 404:
            raise ProductNotFound()
        if response.status_code != 200:
            raise UpstreamUnavailable(f"product-service returned {response.status_code}")
        try:
            data = response.json()
            return ProductInfo(
                id=uuid.UUID(data["id"]),
                name=data["name"],
                price_cents=int(data["price_cents"]),
                stock=int(data["stock"]),
            )
        except (ValueError, KeyError, TypeError):
            raise UpstreamUnavailable("invalid response from product-service") from None

    def decrement(self, product_id: uuid.UUID, quantity: int) -> None:
        """Atomic stock decrement. Raises InsufficientStock (409) or ProductNotFound (404)."""
        self._stock_change("decrement", product_id, quantity)

    def increment(self, product_id: uuid.UUID, quantity: int) -> None:
        """Gives stock back (compensation for a decrement)."""
        self._stock_change("increment", product_id, quantity)

    def _stock_change(self, action: str, product_id: uuid.UUID, quantity: int) -> None:
        try:
            response = self._client.post(
                f"/internal/products/{product_id}/{action}",
                json={"quantity": quantity},
                headers=self._internal_headers,
            )
        except httpx.HTTPError:
            raise UpstreamUnavailable("product-service is unreachable") from None
        if response.status_code == 200:
            return
        if response.status_code == 404:
            raise ProductNotFound()
        if response.status_code == 409 and action == "decrement":
            raise InsufficientStock()
        # 403 here means INTERNAL_API_KEY differs from product-service
        raise UpstreamUnavailable(f"product-service returned {response.status_code}")


@lru_cache
def get_product_client() -> ProductClient:
    return ProductClient(settings.PRODUCT_SERVICE_URL, settings.INTERNAL_API_KEY)
