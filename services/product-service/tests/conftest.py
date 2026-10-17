import os

# Must be set before the app is imported. Tests never touch a real database.
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["ADMIN_API_KEY"] = "test-admin-key-0123456789abcdef"
os.environ["INTERNAL_API_KEY"] = "test-internal-key-0123456789abcd"
os.environ["LOG_LEVEL"] = "WARNING"

from datetime import datetime, timezone  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.db import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base, Category, Product  # noqa: E402


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
def client(session_factory):
    def override_get_db():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def admin_headers():
    return {"X-Admin-Key": os.environ["ADMIN_API_KEY"]}


@pytest.fixture()
def internal_headers():
    return {"X-Internal-Key": os.environ["INTERNAL_API_KEY"]}


@pytest.fixture()
def catalog(session_factory):
    """2 categories and 5 products with fixed dates and prices (stock 10 each)."""
    with session_factory() as db:
        boards = Category(name="Boards", slug="boards")
        sensors = Category(name="Sensors", slug="sensors")
        db.add_all([boards, sensors])
        db.flush()
        rows = [
            ("B-1", "Arduino Uno", "arduino-uno", 2700, boards, 1),
            ("B-2", "ESP32 DevKit", "esp32-devkit", 900, boards, 2),
            ("S-1", "DHT22 Sensor", "dht22-sensor", 650, sensors, 3),
            ("S-2", "HC-SR04 Ultrasonic Sensor", "hc-sr04-ultrasonic", 300, sensors, 4),
            ("S-3", "BMP280 Pressure Sensor", "bmp280-sensor", 450, sensors, 5),
        ]
        for sku, name, slug, price, category, day in rows:
            db.add(
                Product(
                    sku=sku,
                    name=name,
                    slug=slug,
                    price_cents=price,
                    stock=10,
                    category=category,
                    created_at=datetime(2026, 1, day, tzinfo=timezone.utc),
                )
            )
        db.commit()
        return {"boards_id": str(boards.id), "sensors_id": str(sensors.id)}
