import uuid

import httpx
import pytest

from app.clients.product_client import ProductClient, ProductNotFound, ProductServiceUnavailable

PID = uuid.uuid4()


def make_client(handler) -> ProductClient:
    return ProductClient("http://product-service.test:8000/", transport=httpx.MockTransport(handler))


def test_get_product_parses_response_and_uses_by_id_path():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        return httpx.Response(
            200, json={"id": str(PID), "name": "ESP32", "price_cents": 899, "stock": 7, "extra": 1}
        )

    info = make_client(handler).get_product(PID)
    assert (info.id, info.name, info.price_cents, info.stock) == (PID, "ESP32", 899, 7)
    assert seen["url"] == f"http://product-service.test:8000/api/product-service/products/by-id/{PID}"


def test_404_means_product_not_found():
    client = make_client(lambda request: httpx.Response(404, json={"detail": "Product not found"}))
    with pytest.raises(ProductNotFound):
        client.get_product(PID)


@pytest.mark.parametrize("status", [500, 502, 503, 401])
def test_other_statuses_mean_unavailable(status):
    client = make_client(lambda request: httpx.Response(status, json={"detail": "x"}))
    with pytest.raises(ProductServiceUnavailable):
        client.get_product(PID)


@pytest.mark.parametrize("error", [httpx.ConnectTimeout("t"), httpx.ReadTimeout("t"), httpx.ConnectError("c")])
def test_network_errors_mean_unavailable(error):
    def handler(request: httpx.Request) -> httpx.Response:
        raise error

    with pytest.raises(ProductServiceUnavailable):
        make_client(handler).get_product(PID)


@pytest.mark.parametrize(
    "body", [{"id": str(PID)}, {"id": "not-a-uuid", "name": "x", "price_cents": 1, "stock": 1}, "text"]
)
def test_malformed_response_means_unavailable(body):
    client = make_client(lambda request: httpx.Response(200, json=body))
    with pytest.raises(ProductServiceUnavailable):
        client.get_product(PID)
