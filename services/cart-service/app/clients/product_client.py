import uuid
from dataclasses import dataclass
from functools import lru_cache

import httpx

from app.core.config import settings


class ProductNotFound(Exception):
    pass


class ProductServiceUnavailable(Exception):
    pass


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
        timeout: float = 3.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"), timeout=timeout, transport=transport
        )

    def get_product(self, product_id: uuid.UUID) -> ProductInfo:
        try:
            response = self._client.get(f"/api/product-service/products/by-id/{product_id}")
        except httpx.HTTPError:  # timeouts, connection errors, ...
            raise ProductServiceUnavailable("product-service is unreachable") from None
        if response.status_code == 404:
            raise ProductNotFound()
        if response.status_code != 200:
            raise ProductServiceUnavailable(f"unexpected status {response.status_code}")
        try:
            data = response.json()
            return ProductInfo(
                id=uuid.UUID(data["id"]),
                name=data["name"],
                price_cents=int(data["price_cents"]),
                stock=int(data["stock"]),
            )
        except (ValueError, KeyError, TypeError):
            raise ProductServiceUnavailable("invalid response from product-service") from None


@lru_cache
def get_product_client() -> ProductClient:
    return ProductClient(settings.PRODUCT_SERVICE_URL)
