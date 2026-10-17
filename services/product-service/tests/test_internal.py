import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Category, Product
from app.services.stock import decrement_stock

PRODUCTS = "/api/product-service/products"
INTERNAL = "/internal/products"


def product(client, slug="esp32-devkit"):
    return client.get(f"{PRODUCTS}/{slug}").json()


@pytest.mark.parametrize("action", ["decrement", "increment"])
@pytest.mark.parametrize(
    "headers", [{}, {"X-Internal-Key": "wrong-key-wrong-key"}], ids=["no-key", "wrong-key"]
)
def test_rejects_missing_or_wrong_key(client, catalog, action, headers):
    item = product(client)
    response = client.post(
        f"{INTERNAL}/{item['id']}/{action}", json={"quantity": 1}, headers=headers
    )
    assert response.status_code == 403
    assert response.json() == {"detail": "Invalid or missing internal key"}
    assert product(client)["stock"] == item["stock"]


def test_admin_key_does_not_open_internal_endpoints(client, catalog, admin_headers):
    item = product(client)
    response = client.post(
        f"{INTERNAL}/{item['id']}/decrement", json={"quantity": 1}, headers=admin_headers
    )
    assert response.status_code == 403
    assert product(client)["stock"] == 10


def test_decrement(client, catalog, internal_headers):
    item = product(client)
    response = client.post(
        f"{INTERNAL}/{item['id']}/decrement", json={"quantity": 3}, headers=internal_headers
    )
    assert response.status_code == 200
    assert response.json() == {"product_id": item["id"], "stock": 7}
    assert product(client)["stock"] == 7


def test_decrement_to_zero_then_409(client, catalog, internal_headers):
    item = product(client)
    url = f"{INTERNAL}/{item['id']}/decrement"
    assert client.post(url, json={"quantity": 10}, headers=internal_headers).json()["stock"] == 0
    response = client.post(url, json={"quantity": 1}, headers=internal_headers)
    assert response.status_code == 409
    assert response.json() == {"detail": "Insufficient stock"}
    assert product(client)["stock"] == 0


def test_decrement_insufficient_stock_returns_409(client, catalog, internal_headers):
    item = product(client)
    response = client.post(
        f"{INTERNAL}/{item['id']}/decrement", json={"quantity": 11}, headers=internal_headers
    )
    assert response.status_code == 409
    assert response.json() == {"detail": "Insufficient stock"}
    assert product(client)["stock"] == 10


def test_increment(client, catalog, internal_headers):
    item = product(client)
    response = client.post(
        f"{INTERNAL}/{item['id']}/increment", json={"quantity": 5}, headers=internal_headers
    )
    assert response.status_code == 200
    assert response.json() == {"product_id": item["id"], "stock": 15}
    assert product(client)["stock"] == 15


def test_decrement_then_increment_restores_stock(client, catalog, internal_headers):
    item = product(client)
    client.post(f"{INTERNAL}/{item['id']}/decrement", json={"quantity": 4}, headers=internal_headers)
    client.post(f"{INTERNAL}/{item['id']}/increment", json={"quantity": 4}, headers=internal_headers)
    assert product(client)["stock"] == 10


@pytest.mark.parametrize("action", ["decrement", "increment"])
def test_unknown_product_returns_404(client, catalog, internal_headers, action):
    response = client.post(
        f"{INTERNAL}/{uuid.uuid4()}/{action}", json={"quantity": 1}, headers=internal_headers
    )
    assert response.status_code == 404
    assert response.json() == {"detail": "Product not found"}


@pytest.mark.parametrize(
    "body", [{"quantity": 0}, {"quantity": -1}, {"quantity": 1_000_001}, {"quantity": "x"}, {}]
)
def test_invalid_quantity_returns_422(client, catalog, internal_headers, body):
    item = product(client)
    response = client.post(f"{INTERNAL}/{item['id']}/decrement", json=body, headers=internal_headers)
    assert response.status_code == 422
    assert product(client)["stock"] == 10


def test_bad_uuid_returns_422(client, catalog, internal_headers):
    response = client.post(
        f"{INTERNAL}/not-a-uuid/decrement", json={"quantity": 1}, headers=internal_headers
    )
    assert response.status_code == 422


def test_internal_endpoints_are_hidden_from_openapi(client):
    paths = client.get("/openapi.json").json()["paths"]
    assert not any(path.startswith("/internal") for path in paths)


def test_concurrent_decrements_never_oversell(tmp_path):
    engine = create_engine(
        f"sqlite+pysqlite:///{tmp_path / 'race.db'}",
        connect_args={"check_same_thread": False, "timeout": 30},
    )
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        category = Category(name="Boards", slug="boards")
        item = Product(sku="R-1", name="Race", slug="race", price_cents=100, stock=10, category=category)
        db.add_all([category, item])
        db.commit()
        product_id = item.id

    def buy_one(_):
        with Session(engine) as db:
            new_stock = decrement_stock(db, product_id, 1)
            db.commit()
            return new_stock is not None

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(buy_one, range(25)))

    assert results.count(True) == 10
    assert results.count(False) == 15
    with Session(engine) as db:
        assert db.get(Product, product_id).stock == 0
