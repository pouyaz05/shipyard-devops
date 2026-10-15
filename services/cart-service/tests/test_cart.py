import uuid

import pytest

from app.clients.product_client import ProductInfo, ProductServiceUnavailable

CART = "/api/cart-service/cart"
ITEMS = f"{CART}/items"


def add(client, headers, product_id, quantity=1):
    return client.post(
        ITEMS, json={"product_id": str(product_id), "quantity": quantity}, headers=headers
    )


# ---------- authentication ----------


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("GET", CART, None),
        ("POST", ITEMS, {"product_id": str(uuid.uuid4()), "quantity": 1}),
        ("PATCH", f"{ITEMS}/{uuid.uuid4()}", {"quantity": 2}),
        ("DELETE", f"{ITEMS}/{uuid.uuid4()}", None),
        ("DELETE", CART, None),
    ],
)
def test_every_endpoint_requires_a_token(client, method, path, body):
    response = client.request(method, path, json=body)
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or missing token"}


def test_invalid_tokens_are_rejected(client, make_token):
    tokens = {
        "garbage": "not-a-token",
        "expired": make_token(uuid.uuid4(), expires_in=-10),
        "other secret": make_token(uuid.uuid4(), secret="x" * 40),
        "wrong algorithm": make_token(uuid.uuid4(), algorithm="HS512"),
        "sub is not a uuid": make_token("not-a-uuid"),
        "no sub": make_token(None),
    }
    for name, token in tokens.items():
        response = client.get(CART, headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401, name


# ---------- read ----------


def test_empty_cart(client, auth, products):
    response = client.get(CART, headers=auth)
    assert response.status_code == 200
    assert response.json() == {"items": [], "total_cents": 0}
    assert products.calls == []  # reading never calls product-service


# ---------- add ----------


def test_add_item_stores_a_snapshot(client, auth, products, product_a):
    response = add(client, auth, product_a, 2)
    assert response.status_code == 201
    body = response.json()
    assert body["total_cents"] == 5400
    assert body["items"] == [
        {
            "product_id": str(product_a),
            "product_name": "Arduino Uno",
            "unit_price_cents": 2700,
            "quantity": 2,
            "line_total_cents": 5400,
        }
    ]
    assert products.calls == [product_a]
    assert client.get(CART, headers=auth).json() == body


def test_adding_the_same_product_sums_quantity_and_refreshes_snapshot(
    client, auth, products, product_a
):
    add(client, auth, product_a, 2)
    products.products[product_a] = ProductInfo(product_a, "Arduino Uno R3", 2500, 10)
    response = add(client, auth, product_a, 3)
    assert response.status_code == 200
    item = response.json()["items"][0]
    assert (item["quantity"], item["unit_price_cents"], item["product_name"]) == (
        5,
        2500,
        "Arduino Uno R3",
    )


def test_total_covers_all_items(client, auth, product_a, product_b):
    add(client, auth, product_a, 2)
    add(client, auth, product_b, 3)
    body = client.get(CART, headers=auth).json()
    assert body["total_cents"] == 2 * 2700 + 3 * 900
    assert [i["product_name"] for i in body["items"]] == ["Arduino Uno", "ESP32 DevKit"]


def test_add_unknown_product_returns_404(client, auth):
    response = add(client, auth, uuid.uuid4())
    assert response.status_code == 404
    assert response.json() == {"detail": "Product not found"}
    assert client.get(CART, headers=auth).json()["items"] == []


def test_add_more_than_stock_returns_409(client, auth, product_a):
    response = add(client, auth, product_a, 11)
    assert response.status_code == 409
    assert response.json() == {"detail": "Insufficient stock"}
    assert client.get(CART, headers=auth).json()["items"] == []


def test_merged_quantity_cannot_exceed_stock(client, auth, product_a):
    add(client, auth, product_a, 6)
    response = add(client, auth, product_a, 5)
    assert response.status_code == 409
    assert client.get(CART, headers=auth).json()["items"][0]["quantity"] == 6


def test_add_returns_502_when_product_service_is_down(client, auth, products, product_a):
    products.error = ProductServiceUnavailable("down")
    response = add(client, auth, product_a)
    assert response.status_code == 502
    assert response.json() == {"detail": "Product service unavailable"}
    assert client.get(CART, headers=auth).json()["items"] == []


@pytest.mark.parametrize(
    "body",
    [
        {"product_id": str(uuid.uuid4()), "quantity": 0},
        {"product_id": str(uuid.uuid4()), "quantity": 1001},
        {"product_id": "not-a-uuid", "quantity": 1},
        {"quantity": 1},
    ],
)
def test_add_validates_the_body(client, auth, body):
    assert client.post(ITEMS, json=body, headers=auth).status_code == 422


# ---------- update ----------


def test_patch_changes_quantity(client, auth, product_a):
    add(client, auth, product_a, 2)
    response = client.patch(f"{ITEMS}/{product_a}", json={"quantity": 5}, headers=auth)
    assert response.status_code == 200
    assert response.json()["items"][0]["quantity"] == 5
    assert response.json()["total_cents"] == 5 * 2700


def test_patch_above_stock_returns_409(client, auth, product_a):
    add(client, auth, product_a, 2)
    response = client.patch(f"{ITEMS}/{product_a}", json={"quantity": 11}, headers=auth)
    assert response.status_code == 409
    assert response.json() == {"detail": "Insufficient stock"}
    assert client.get(CART, headers=auth).json()["items"][0]["quantity"] == 2


def test_patch_decrease_works_even_if_product_service_is_down(client, auth, products, product_a):
    add(client, auth, product_a, 4)
    products.error = ProductServiceUnavailable("down")
    products.calls.clear()
    response = client.patch(f"{ITEMS}/{product_a}", json={"quantity": 1}, headers=auth)
    assert response.status_code == 200
    assert response.json()["items"][0]["quantity"] == 1
    assert products.calls == []


def test_patch_increase_returns_502_when_product_service_is_down(client, auth, products, product_a):
    add(client, auth, product_a, 1)
    products.error = ProductServiceUnavailable("down")
    response = client.patch(f"{ITEMS}/{product_a}", json={"quantity": 3}, headers=auth)
    assert response.status_code == 502


def test_patch_item_not_in_cart_returns_404(client, auth, product_a):
    response = client.patch(f"{ITEMS}/{product_a}", json={"quantity": 2}, headers=auth)
    assert response.status_code == 404
    assert response.json() == {"detail": "Item not in cart"}


def test_patch_rejects_zero_quantity(client, auth, product_a):
    add(client, auth, product_a, 1)
    assert client.patch(f"{ITEMS}/{product_a}", json={"quantity": 0}, headers=auth).status_code == 422


# ---------- delete ----------


def test_delete_item(client, auth, product_a, product_b):
    add(client, auth, product_a, 1)
    add(client, auth, product_b, 1)
    assert client.delete(f"{ITEMS}/{product_a}", headers=auth).status_code == 204
    items = client.get(CART, headers=auth).json()["items"]
    assert [i["product_id"] for i in items] == [str(product_b)]
    response = client.delete(f"{ITEMS}/{product_a}", headers=auth)
    assert response.status_code == 404
    assert response.json() == {"detail": "Item not in cart"}


def test_clear_cart(client, auth, product_a, product_b):
    add(client, auth, product_a, 1)
    add(client, auth, product_b, 1)
    assert client.delete(CART, headers=auth).status_code == 204
    assert client.get(CART, headers=auth).json() == {"items": [], "total_cents": 0}


def test_clear_cart_without_a_cart_is_ok(client, auth):
    assert client.delete(CART, headers=auth).status_code == 204


# ---------- isolation ----------


def test_carts_are_per_user(client, auth, other_auth, product_a):
    add(client, auth, product_a, 2)
    assert client.get(CART, headers=other_auth).json() == {"items": [], "total_cents": 0}
    assert client.delete(f"{ITEMS}/{product_a}", headers=other_auth).status_code == 404
    assert client.get(CART, headers=auth).json()["items"][0]["quantity"] == 2
