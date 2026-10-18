import json
import uuid

import httpx
import pytest

from app.clients.errors import InsufficientStock, ProductNotFound, UpstreamUnavailable
from app.clients.product_client import ProductClient

PID = uuid.uuid4()
KEY = "test-internal-key-0123456789abcd"
BASE = "http://product-service.test:8000"


def make_client(handler) -> ProductClient:
    return ProductClient(f"{BASE}/", KEY, transport=httpx.MockTransport(handler))


# ---------- get_product ----------


def test_get_product_parses_response_and_does_not_send_the_internal_key():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(url=str(request.url), key=request.headers.get("x-internal-key"))
        return httpx.Response(
            200, json={"id": str(PID), "name": "ESP32", "price_cents": 899, "stock": 7, "extra": 1}
        )

    info = make_client(handler).get_product(PID)
    assert (info.id, info.name, info.price_cents, info.stock) == (PID, "ESP32", 899, 7)
    assert seen == {"url": f"{BASE}/api/product-service/products/by-id/{PID}", "key": None}


def test_get_product_404_means_not_found():
    client = make_client(lambda request: httpx.Response(404, json={"detail": "Product not found"}))
    with pytest.raises(ProductNotFound):
        client.get_product(PID)


@pytest.mark.parametrize("status", [401, 500, 502])
def test_get_product_other_statuses_mean_unavailable(status):
    client = make_client(lambda request: httpx.Response(status))
    with pytest.raises(UpstreamUnavailable):
        client.get_product(PID)


@pytest.mark.parametrize(
    "body", [{"id": str(PID)}, {"id": "bad", "name": "x", "price_cents": 1, "stock": 1}, "text"]
)
def test_get_product_malformed_response_means_unavailable(body):
    client = make_client(lambda request: httpx.Response(200, json=body))
    with pytest.raises(UpstreamUnavailable):
        client.get_product(PID)


# ---------- decrement / increment ----------


@pytest.mark.parametrize("action", ["decrement", "increment"])
def test_stock_change_sends_the_internal_key_and_quantity(action):
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(
            method=request.method,
            url=str(request.url),
            key=request.headers.get("x-internal-key"),
            body=json.loads(request.content),
        )
        return httpx.Response(200, json={"product_id": str(PID), "stock": 7})

    getattr(make_client(handler), action)(PID, 3)
    assert seen == {
        "method": "POST",
        "url": f"{BASE}/internal/products/{PID}/{action}",
        "key": KEY,
        "body": {"quantity": 3},
    }


def test_decrement_409_means_insufficient_stock():
    client = make_client(lambda request: httpx.Response(409, json={"detail": "Insufficient stock"}))
    with pytest.raises(InsufficientStock):
        client.decrement(PID, 1)


@pytest.mark.parametrize("action", ["decrement", "increment"])
def test_stock_change_404_means_not_found(action):
    client = make_client(lambda request: httpx.Response(404, json={"detail": "Product not found"}))
    with pytest.raises(ProductNotFound):
        getattr(client, action)(PID, 1)


@pytest.mark.parametrize("action", ["decrement", "increment"])
@pytest.mark.parametrize("status", [403, 422, 500])
def test_stock_change_other_statuses_mean_unavailable(action, status):
    client = make_client(lambda request: httpx.Response(status))
    with pytest.raises(UpstreamUnavailable):
        getattr(client, action)(PID, 1)


def test_increment_409_is_not_insufficient_stock():
    client = make_client(lambda request: httpx.Response(409))
    with pytest.raises(UpstreamUnavailable):
        client.increment(PID, 1)


@pytest.mark.parametrize("error", [httpx.ConnectTimeout("t"), httpx.ReadTimeout("t"), httpx.ConnectError("c")])
def test_network_errors_mean_unavailable(error):
    def handler(request: httpx.Request) -> httpx.Response:
        raise error

    client = make_client(handler)
    with pytest.raises(UpstreamUnavailable):
        client.get_product(PID)
    with pytest.raises(UpstreamUnavailable):
        client.decrement(PID, 1)
    with pytest.raises(UpstreamUnavailable):
        client.increment(PID, 1)


def test_default_timeout_is_three_seconds():
    assert make_client(lambda request: httpx.Response(200))._client.timeout == httpx.Timeout(3.0)
