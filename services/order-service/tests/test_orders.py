import uuid
from dataclasses import replace

import pytest
from sqlalchemy.exc import OperationalError

from app.clients.errors import InsufficientStock, UpstreamUnavailable
from app.models import Order

ORDERS = "/api/order-service/orders"
SHIPPING = {
    "shipping_name": "Alice Doe",
    "shipping_address": "1 Main St",
    "shipping_city": "Springfield",
}


# ---------- authentication ----------


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("POST", ORDERS, SHIPPING),
        ("GET", ORDERS, None),
        ("GET", f"{ORDERS}/{uuid.uuid4()}", None),
        ("POST", f"{ORDERS}/{uuid.uuid4()}/pay", None),
    ],
)
def test_every_endpoint_requires_a_token(client, cart, method, path, body):
    response = client.request(method, path, json=body)
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or missing token"}
    assert cart.tokens == []


def test_invalid_tokens_are_rejected(client, make_token):
    tokens = {
        "garbage": "not-a-token",
        "expired": make_token(uuid.uuid4(), expires_in=-10),
        "other secret": make_token(uuid.uuid4(), secret="x" * 40),
        "wrong algorithm": make_token(uuid.uuid4(), algorithm="HS512"),
        "sub is not a uuid": make_token("not-a-uuid"),
        "no sub": make_token(None),
    }
    for name, bad_token in tokens.items():
        response = client.get(ORDERS, headers={"Authorization": f"Bearer {bad_token}"})
        assert response.status_code == 401, name


# ---------- create: success ----------


def test_create_order_snapshots_the_cart_and_reserves_stock(client, auth, products, filled):
    uno, esp = filled
    response = client.post(ORDERS, json=SHIPPING, headers=auth)
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "PENDING_PAYMENT"
    assert body["total_cents"] == 2 * 2700 + 900
    assert {key: body[key] for key in SHIPPING} == SHIPPING
    items = {item["product_id"]: item for item in body["items"]}
    assert items[str(uno)]["product_name"] == "Arduino Uno"
    assert items[str(uno)]["unit_price_cents"] == 2700
    assert items[str(uno)]["quantity"] == 2
    assert items[str(uno)]["line_total_cents"] == 5400
    assert items[str(esp)]["quantity"] == 1
    assert sorted(products.decrements) == sorted([(uno, 2), (esp, 1)])
    assert products.increments == []
    assert products.products[uno].stock == 8
    assert products.products[esp].stock == 4


def test_create_order_clears_the_cart_and_forwards_the_users_token(
    client, auth, token, cart, filled
):
    assert client.post(ORDERS, json=SHIPPING, headers=auth).status_code == 201
    assert cart.clears == 1
    assert cart.lines == []
    assert cart.tokens == [token, token]  # one read, one clear, both with the user's token


def test_order_snapshot_survives_later_price_changes(client, auth, products, filled):
    uno, _ = filled
    order_id = client.post(ORDERS, json=SHIPPING, headers=auth).json()["id"]
    products.products[uno] = replace(products.products[uno], price_cents=9999, name="Renamed")
    fetched = client.get(f"{ORDERS}/{order_id}", headers=auth).json()
    item = next(i for i in fetched["items"] if i["product_id"] == str(uno))
    assert (item["unit_price_cents"], item["product_name"]) == (2700, "Arduino Uno")
    assert fetched["total_cents"] == 2 * 2700 + 900


def test_no_http_call_happens_inside_the_db_transaction(client, auth, filled, events):
    assert client.post(ORDERS, json=SHIPPING, headers=auth).status_code == 201
    begin = events.index("db:begin")
    commit = events.index("db:commit")
    assert all(e.startswith("http:") for e in events[:begin])  # database untouched before saving
    assert not [e for e in events[begin:commit] if e.startswith("http:")]
    assert events[commit + 1 :] == ["http:clear_cart"]  # the cart is cleared after the commit


# ---------- create: refusals ----------


def test_empty_cart_returns_400(client, auth, cart, products, events):
    response = client.post(ORDERS, json=SHIPPING, headers=auth)
    assert response.status_code == 400
    assert response.json() == {"detail": "Cart is empty"}
    assert "http:get_product" not in events
    assert products.decrements == []
    assert client.get(ORDERS, headers=auth).json() == []


def test_changed_price_returns_409_and_creates_nothing(client, auth, cart, products, filled):
    uno, _ = filled
    products.products[uno] = replace(products.products[uno], price_cents=2500)
    response = client.post(ORDERS, json=SHIPPING, headers=auth)
    assert response.status_code == 409
    detail = response.json()["detail"]
    assert "Price changed" in detail
    assert "Arduino Uno" in detail
    assert "$27.00" in detail and "$25.00" in detail
    assert products.decrements == []
    assert cart.clears == 0 and len(cart.lines) == 2
    assert client.get(ORDERS, headers=auth).json() == []


def test_product_removed_from_catalog_returns_409(client, auth, products, filled):
    _, esp = filled
    del products.products[esp]
    response = client.post(ORDERS, json=SHIPPING, headers=auth)
    assert response.status_code == 409
    assert "no longer available" in response.json()["detail"]
    assert products.decrements == []


def test_out_of_stock_is_refused_before_any_stock_is_touched(client, auth, products, filled):
    _, esp = filled
    products.products[esp] = replace(products.products[esp], stock=0)
    response = client.post(ORDERS, json=SHIPPING, headers=auth)
    assert response.status_code == 409
    assert response.json() == {"detail": "Insufficient stock for 'ESP32 DevKit'"}
    assert products.decrements == []
    assert products.increments == []


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"shipping_name": "A", "shipping_address": "B"},
        {**SHIPPING, "shipping_city": ""},
        {**SHIPPING, "shipping_name": "   "},
        {**SHIPPING, "shipping_address": "x" * 501},
    ],
)
def test_invalid_body_returns_422_and_calls_nothing(client, auth, cart, body):
    assert client.post(ORDERS, json=body, headers=auth).status_code == 422
    assert cart.tokens == []


# ---------- create: failures midway (compensation) ----------


def test_stock_race_gives_back_the_earlier_decrements(client, auth, cart, products, filled):
    uno, esp = filled
    products.decrement_failures[esp] = InsufficientStock()  # someone else took it meanwhile
    response = client.post(ORDERS, json=SHIPPING, headers=auth)
    assert response.status_code == 409
    assert response.json() == {"detail": "Insufficient stock for 'ESP32 DevKit'"}
    assert products.decrements == [(uno, 2)]
    assert products.increments == [(uno, 2)]
    assert products.products[uno].stock == 10  # restored
    assert cart.clears == 0
    assert client.get(ORDERS, headers=auth).json() == []


def test_network_error_while_reserving_returns_502_and_compensates(
    client, auth, products, filled
):
    uno, esp = filled
    products.decrement_failures[esp] = UpstreamUnavailable("down")
    response = client.post(ORDERS, json=SHIPPING, headers=auth)
    assert response.status_code == 502
    assert response.json() == {"detail": "Product service unavailable"}
    assert products.increments == [(uno, 2)]
    assert client.get(ORDERS, headers=auth).json() == []


def test_failed_compensation_does_not_hide_the_original_error(client, auth, products, filled):
    _, esp = filled
    products.decrement_failures[esp] = InsufficientStock()
    products.increment_error = UpstreamUnavailable("down")
    response = client.post(ORDERS, json=SHIPPING, headers=auth)
    assert response.status_code == 409
    assert products.increments == []


def test_database_failure_restores_all_stock(client, auth, cart, products, filled, monkeypatch):
    uno, esp = filled

    def boom(*args, **kwargs):
        raise OperationalError("INSERT", {}, Exception("db down"))

    monkeypatch.setattr("app.routers.orders._save_order", boom)
    response = client.post(ORDERS, json=SHIPPING, headers=auth)
    assert response.status_code == 500
    assert response.json() == {"detail": "Could not create the order"}
    assert sorted(products.increments) == sorted([(uno, 2), (esp, 1)])
    assert products.products[uno].stock == 10 and products.products[esp].stock == 5
    assert cart.clears == 0


def test_failing_to_clear_the_cart_keeps_the_order(client, auth, cart, filled):
    cart.clear_error = UpstreamUnavailable("down")
    response = client.post(ORDERS, json=SHIPPING, headers=auth)
    assert response.status_code == 201
    assert len(client.get(ORDERS, headers=auth).json()) == 1


def test_cart_service_down_returns_502(client, auth, cart, products, filled):
    cart.get_error = UpstreamUnavailable("down")
    response = client.post(ORDERS, json=SHIPPING, headers=auth)
    assert response.status_code == 502
    assert response.json() == {"detail": "Cart service unavailable"}
    assert products.decrements == []


def test_product_service_down_during_price_check_returns_502(client, auth, cart, products, filled):
    products.get_error = UpstreamUnavailable("down")
    response = client.post(ORDERS, json=SHIPPING, headers=auth)
    assert response.status_code == 502
    assert response.json() == {"detail": "Product service unavailable"}
    assert products.decrements == []
    assert cart.clears == 0


# ---------- list and get ----------


def test_list_returns_only_own_orders_newest_first(
    client, auth, user_id, other_user_id, make_order
):
    oldest = make_order(user_id, 1)
    newest = make_order(user_id, 3)
    middle = make_order(user_id, 2)
    make_order(other_user_id, 4)
    response = client.get(ORDERS, headers=auth)
    assert response.status_code == 200
    assert [o["id"] for o in response.json()] == [str(newest), str(middle), str(oldest)]


def test_list_is_empty_for_a_new_user(client, auth):
    assert client.get(ORDERS, headers=auth).json() == []


def test_list_limit_and_offset(client, auth, user_id, make_order):
    ids = [make_order(user_id, day) for day in (1, 2, 3)]
    first = client.get(ORDERS, params={"limit": 2}, headers=auth).json()
    assert [o["id"] for o in first] == [str(ids[2]), str(ids[1])]
    second = client.get(ORDERS, params={"limit": 2, "offset": 2}, headers=auth).json()
    assert [o["id"] for o in second] == [str(ids[0])]


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 101}, {"offset": -1}])
def test_list_rejects_bad_paging(client, auth, params):
    assert client.get(ORDERS, params=params, headers=auth).status_code == 422


def test_get_own_order(client, auth, user_id, make_order):
    order_id = make_order(user_id, 1)
    response = client.get(f"{ORDERS}/{order_id}", headers=auth)
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(order_id)
    assert body["status"] == "PENDING_PAYMENT"
    assert body["items"][0]["line_total_cents"] == 5400


def test_another_users_order_is_404(client, auth, other_user_id, make_order):
    order_id = make_order(other_user_id, 1)
    response = client.get(f"{ORDERS}/{order_id}", headers=auth)
    assert response.status_code == 404
    assert response.json() == {"detail": "Order not found"}


def test_unknown_order_is_404(client, auth):
    assert client.get(f"{ORDERS}/{uuid.uuid4()}", headers=auth).status_code == 404


def test_bad_order_id_is_422(client, auth):
    assert client.get(f"{ORDERS}/not-a-uuid", headers=auth).status_code == 422


# ---------- pay ----------


def test_pay_moves_the_order_to_paid(client, auth, user_id, make_order):
    order_id = make_order(user_id, 1)
    response = client.post(f"{ORDERS}/{order_id}/pay", headers=auth)
    assert response.status_code == 200
    assert response.json()["status"] == "PAID"
    assert client.get(f"{ORDERS}/{order_id}", headers=auth).json()["status"] == "PAID"


def test_paying_twice_returns_409(client, auth, user_id, make_order):
    order_id = make_order(user_id, 1)
    assert client.post(f"{ORDERS}/{order_id}/pay", headers=auth).status_code == 200
    response = client.post(f"{ORDERS}/{order_id}/pay", headers=auth)
    assert response.status_code == 409
    assert response.json() == {"detail": "Order is not awaiting payment"}
    assert client.get(f"{ORDERS}/{order_id}", headers=auth).json()["status"] == "PAID"


@pytest.mark.parametrize("status", ["PAID", "CANCELLED"])
def test_only_pending_orders_can_be_paid(client, auth, user_id, make_order, status):
    order_id = make_order(user_id, 1, status=status)
    response = client.post(f"{ORDERS}/{order_id}/pay", headers=auth)
    assert response.status_code == 409
    assert client.get(f"{ORDERS}/{order_id}", headers=auth).json()["status"] == status


def test_cannot_pay_another_users_order(client, auth, other_user_id, make_order, session_factory):
    order_id = make_order(other_user_id, 1)
    response = client.post(f"{ORDERS}/{order_id}/pay", headers=auth)
    assert response.status_code == 404
    assert response.json() == {"detail": "Order not found"}
    with session_factory() as db:
        assert db.get(Order, order_id).status == "PENDING_PAYMENT"


def test_pay_unknown_order_is_404(client, auth):
    assert client.post(f"{ORDERS}/{uuid.uuid4()}/pay", headers=auth).status_code == 404
