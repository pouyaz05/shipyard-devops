import os

# Must be set before the app is imported. Tests never touch a real database or network.
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-0123"
os.environ["CART_SERVICE_URL"] = "http://cart-service.test:8000"
os.environ["PRODUCT_SERVICE_URL"] = "http://product-service.test:8000"
os.environ["INTERNAL_API_KEY"] = "test-internal-key-0123456789abcd"
os.environ["LOG_LEVEL"] = "WARNING"

import time  # noqa: E402
import uuid  # noqa: E402
from dataclasses import replace  # noqa: E402
from datetime import datetime, timezone  # noqa: E402

import jwt  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.clients.cart_client import CartLine, get_cart_client  # noqa: E402
from app.clients.errors import InsufficientStock, ProductNotFound  # noqa: E402
from app.clients.product_client import ProductInfo, get_product_client  # noqa: E402
from app.core.db import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base, Order, OrderItem  # noqa: E402


class FakeCart:
    """Stands in for CartClient: no network."""

    def __init__(self, events):
        self.events = events
        self.lines: list[CartLine] = []
        self.get_error: Exception | None = None
        self.clear_error: Exception | None = None
        self.tokens: list[str] = []
        self.clears = 0

    def add(self, product_id, name, price_cents, quantity):
        self.lines.append(CartLine(product_id, name, price_cents, quantity))

    def get_cart(self, token):
        self.events.append("http:get_cart")
        self.tokens.append(token)
        if self.get_error:
            raise self.get_error
        return list(self.lines)

    def clear_cart(self, token):
        self.events.append("http:clear_cart")
        self.tokens.append(token)
        if self.clear_error:
            raise self.clear_error
        self.lines = []
        self.clears += 1


class FakeProducts:
    """Stands in for ProductClient: no network."""

    def __init__(self, events):
        self.events = events
        self.products: dict[uuid.UUID, ProductInfo] = {}
        self.get_error: Exception | None = None
        self.decrement_failures: dict[uuid.UUID, Exception] = {}
        self.increment_error: Exception | None = None
        self.decrements: list[tuple[uuid.UUID, int]] = []
        self.increments: list[tuple[uuid.UUID, int]] = []

    def add(self, name, price_cents, stock) -> uuid.UUID:
        product_id = uuid.uuid4()
        self.products[product_id] = ProductInfo(product_id, name, price_cents, stock)
        return product_id

    def get_product(self, product_id):
        self.events.append("http:get_product")
        if self.get_error:
            raise self.get_error
        if product_id not in self.products:
            raise ProductNotFound()
        return self.products[product_id]

    def decrement(self, product_id, quantity):
        self.events.append("http:decrement")
        if product_id in self.decrement_failures:
            raise self.decrement_failures[product_id]
        product = self.products.get(product_id)
        if product is None:
            raise ProductNotFound()
        if product.stock < quantity:
            raise InsufficientStock()
        self.products[product_id] = replace(product, stock=product.stock - quantity)
        self.decrements.append((product_id, quantity))

    def increment(self, product_id, quantity):
        self.events.append("http:increment")
        if self.increment_error:
            raise self.increment_error
        product = self.products.get(product_id)
        if product is None:
            raise ProductNotFound()
        self.products[product_id] = replace(product, stock=product.stock + quantity)
        self.increments.append((product_id, quantity))


@pytest.fixture()
def events():
    return []


@pytest.fixture()
def cart(events):
    return FakeCart(events)


@pytest.fixture()
def products(events):
    return FakeProducts(events)


@pytest.fixture()
def db_engine():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture()
def session_factory(db_engine):
    return sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)


@pytest.fixture()
def client(db_engine, session_factory, cart, products, events):
    event.listen(db_engine, "begin", lambda conn: events.append("db:begin"))
    event.listen(db_engine, "commit", lambda conn: events.append("db:commit"))

    def override_get_db():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_cart_client] = lambda: cart
    app.dependency_overrides[get_product_client] = lambda: products
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def make_token():
    def _make(sub=None, *, expires_in=3600, secret=None, algorithm="HS256"):
        payload = {"iat": int(time.time()), "exp": int(time.time()) + expires_in}
        if sub is not None:
            payload["sub"] = str(sub)
        return jwt.encode(payload, secret or os.environ["JWT_SECRET"], algorithm=algorithm)

    return _make


@pytest.fixture()
def user_id():
    return uuid.uuid4()


@pytest.fixture()
def other_user_id():
    return uuid.uuid4()


@pytest.fixture()
def token(make_token, user_id):
    return make_token(user_id)


@pytest.fixture()
def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def other_auth(make_token, other_user_id):
    return {"Authorization": f"Bearer {make_token(other_user_id)}"}


@pytest.fixture()
def filled(cart, products):
    """A cart with 2 x Arduino Uno (27.00) and 1 x ESP32 DevKit (9.00); both in stock."""
    uno = products.add("Arduino Uno", 2700, 10)
    esp = products.add("ESP32 DevKit", 900, 5)
    cart.add(uno, "Arduino Uno", 2700, 2)
    cart.add(esp, "ESP32 DevKit", 900, 1)
    return uno, esp


@pytest.fixture()
def make_order(session_factory):
    def _make(owner_id, day, status="PENDING_PAYMENT"):
        with session_factory() as db:
            order = Order(
                user_id=owner_id,
                status=status,
                total_cents=5400,
                shipping_name="Alice Doe",
                shipping_address="1 Main St",
                shipping_city="Springfield",
                created_at=datetime(2026, 1, day, tzinfo=timezone.utc),
            )
            order.items = [
                OrderItem(
                    product_id=uuid.uuid4(),
                    product_name="Arduino Uno",
                    unit_price_cents=2700,
                    quantity=2,
                )
            ]
            db.add(order)
            db.commit()
            return order.id

    return _make
