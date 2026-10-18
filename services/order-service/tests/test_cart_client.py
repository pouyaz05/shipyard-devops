import uuid

import httpx
import pytest

from app.clients.cart_client import CartClient, CartLine
from app.clients.errors import UpstreamUnavailable

PID = uuid.uuid4()
ITEM = {
    "product_id": str(PID),
    "product_name": "ESP32",
    "unit_price_cents": 899,
    "quantity": 2,
    "line_total_cents": 1798,
}


def make_client(handler) -> CartClient:
    return CartClient("http://cart-service.test:8000/", transport=httpx.MockTransport(handler))


def test_get_cart_parses_lines_and_forwards_the_token():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(auth=request.headers.get("authorization"), method=request.method, url=str(request.url))
        return httpx.Response(200, json={"items": [ITEM], "total_cents": 1798})

    lines = make_client(handler).get_cart("tok")
    assert lines == [CartLine(PID, "ESP32", 899, 2)]
    assert seen == {
        "auth": "Bearer tok",
        "method": "GET",
        "url": "http://cart-service.test:8000/api/cart-service/cart",
    }


def test_empty_cart_is_an_empty_list():
    client = make_client(lambda request: httpx.Response(200, json={"items": [], "total_cents": 0}))
    assert client.get_cart("tok") == []


@pytest.mark.parametrize("status", [401, 404, 500, 502])
def test_get_cart_other_statuses_mean_unavailable(status):
    client = make_client(lambda request: httpx.Response(status, json={"detail": "x"}))
    with pytest.raises(UpstreamUnavailable):
        client.get_cart("tok")


@pytest.mark.parametrize(
    "body",
    [{}, {"items": "nope"}, {"items": [{"product_id": "not-a-uuid"}]}, {"items": [{"product_id": str(PID)}]}, "text"],
)
def test_malformed_response_means_unavailable(body):
    client = make_client(lambda request: httpx.Response(200, json=body))
    with pytest.raises(UpstreamUnavailable):
        client.get_cart("tok")


@pytest.mark.parametrize("error", [httpx.ConnectTimeout("t"), httpx.ReadTimeout("t"), httpx.ConnectError("c")])
def test_network_errors_mean_unavailable(error):
    def handler(request: httpx.Request) -> httpx.Response:
        raise error

    client = make_client(handler)
    with pytest.raises(UpstreamUnavailable):
        client.get_cart("tok")
    with pytest.raises(UpstreamUnavailable):
        client.clear_cart("tok")


@pytest.mark.parametrize("status", [200, 204])
def test_clear_cart_sends_delete_with_the_token(status):
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(auth=request.headers.get("authorization"), method=request.method, path=request.url.path)
        return httpx.Response(status)

    make_client(handler).clear_cart("tok")
    assert seen == {"auth": "Bearer tok", "method": "DELETE", "path": "/api/cart-service/cart"}


def test_clear_cart_failure_means_unavailable():
    client = make_client(lambda request: httpx.Response(500))
    with pytest.raises(UpstreamUnavailable):
        client.clear_cart("tok")


def test_default_timeout_is_three_seconds():
    assert make_client(lambda request: httpx.Response(200))._client.timeout == httpx.Timeout(3.0)
