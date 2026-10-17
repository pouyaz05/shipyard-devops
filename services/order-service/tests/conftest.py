import os

# Must be set before the app is imported. Tests never touch a real database or network.
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-0123"
os.environ["CART_SERVICE_URL"] = "http://cart-service.test:8000"
os.environ["PRODUCT_SERVICE_URL"] = "http://product-service.test:8000"
os.environ["INTERNAL_API_KEY"] = "test-internal-key-0123456789abcd"
os.environ["LOG_LEVEL"] = "WARNING"

import time  # noqa: E402

import jwt  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.db import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402


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
def client(db_engine):
    session_factory = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
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
