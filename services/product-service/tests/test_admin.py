import uuid

import pytest

BASE = "/api/product-service/products"


def payload(catalog, **overrides):
    data = {
        "sku": "NEW-1",
        "name": "New Part",
        "price_cents": 199,
        "stock": 5,
        "category_id": catalog["boards_id"],
    }
    data.update(overrides)
    return data


@pytest.mark.parametrize("headers", [{}, {"X-Admin-Key": "wrong-key-wrong-key"}])
@pytest.mark.parametrize("method", ["POST", "PUT", "DELETE"])
def test_write_requires_admin_key(client, catalog, method, headers):
    url = BASE if method == "POST" else f"{BASE}/arduino-uno"
    body = payload(catalog) if method != "DELETE" else None
    response = client.request(method, url, headers=headers, json=body)
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or missing admin key"}
    assert client.get(f"{BASE}/arduino-uno").status_code == 200  # nothing changed


def test_create_product(client, catalog, admin_headers):
    response = client.post(BASE, json=payload(catalog), headers=admin_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["slug"] == "new-part"
    assert body["price_cents"] == 199
    assert body["currency"] == "USD"
    assert body["category"]["slug"] == "boards"
    assert client.get(f"{BASE}/new-part").status_code == 200


def test_create_duplicate_sku(client, catalog, admin_headers):
    response = client.post(BASE, json=payload(catalog, sku="B-1"), headers=admin_headers)
    assert response.status_code == 409
    assert response.json() == {"detail": "SKU or slug already exists"}


def test_create_duplicate_slug(client, catalog, admin_headers):
    response = client.post(BASE, json=payload(catalog, slug="arduino-uno"), headers=admin_headers)
    assert response.status_code == 409


def test_create_unknown_category(client, catalog, admin_headers):
    body = payload(catalog, category_id=str(uuid.uuid4()))
    response = client.post(BASE, json=body, headers=admin_headers)
    assert response.status_code == 422
    assert response.json() == {"detail": "Category not found"}


@pytest.mark.parametrize("override", [{"price_cents": -1}, {"stock": -1}, {"currency": "usd"}])
def test_create_rejects_invalid_values(client, catalog, admin_headers, override):
    response = client.post(BASE, json=payload(catalog, **override), headers=admin_headers)
    assert response.status_code == 422


def test_update_keeps_slug_when_omitted(client, catalog, admin_headers):
    body = payload(catalog, sku="B-1", name="Arduino Uno R3", price_cents=2500)
    response = client.put(f"{BASE}/arduino-uno", json=body, headers=admin_headers)
    assert response.status_code == 200
    fetched = client.get(f"{BASE}/arduino-uno").json()
    assert fetched["name"] == "Arduino Uno R3"
    assert fetched["price_cents"] == 2500


def test_update_can_change_slug(client, catalog, admin_headers):
    body = payload(catalog, sku="B-1", slug="arduino-uno-r3")
    assert client.put(f"{BASE}/arduino-uno", json=body, headers=admin_headers).status_code == 200
    assert client.get(f"{BASE}/arduino-uno-r3").status_code == 200
    assert client.get(f"{BASE}/arduino-uno").status_code == 404


def test_update_not_found(client, catalog, admin_headers):
    response = client.put(f"{BASE}/nope", json=payload(catalog), headers=admin_headers)
    assert response.status_code == 404


def test_delete_product(client, catalog, admin_headers):
    assert client.delete(f"{BASE}/arduino-uno", headers=admin_headers).status_code == 204
    assert client.get(f"{BASE}/arduino-uno").status_code == 404
    assert client.delete(f"{BASE}/arduino-uno", headers=admin_headers).status_code == 404
