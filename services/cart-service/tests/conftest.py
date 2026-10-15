import os

# Must be set before the app is imported. Tests never touch a real database or network.
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-0123"
os.environ["PRODUCT_SERVICE_URL"] = "http://product-service.test:8000"
os.environ["LOG_LEVEL"] = "WARNING"

import time  # noqa: E402
import uuid  # noqa: E402

import jwt  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.clients.product_client import (  # noqa: E402
    ProductInfo,
    ProductNotFound,
    get_product_client,
)
from app.core.db import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402


class FakeProducts:
    """Stands in for ProductClient: no network."""

    def __init__(self):
        self.products: dict[uuid.UUID, ProductInfo] = {}
        self.error: Exception | None = None
        self.calls: list[uuid.UUID] = []

    def add(self, name, price_cents, stock) -> uuid.UUID:
        product_id = uuid.uuid4()
        self.products[product_id] = ProductInfo(product_id, name, price_cents, stock)
        return product_id

    def get_product(self, product_id):
        self.calls.append(product_id)
        if self.error:
            raise self.error
        if product_id not in self.products:
            raise ProductNotFound()
        return self.products[product_id]


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
def products():
    return FakeProducts()


@pytest.fixture()
def client(db_engine, products):
    session_factory = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
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
def auth(make_token):
    return {"Authorization": f"Bearer {make_token(uuid.uuid4())}"}


@pytest.fixture()
def other_auth(make_token):
    return {"Authorization": f"Bearer {make_token(uuid.uuid4())}"}


@pytest.fixture()
def product_a(products):
    return products.add("Arduino Uno", 2700, 10)


@pytest.fixture()
def product_b(products):
    return products.add("ESP32 DevKit", 900, 5)
