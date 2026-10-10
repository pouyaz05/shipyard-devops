from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from app.models import Base
from scripts.seed import CATEGORIES, PRODUCTS, seed


def test_seed_data_is_consistent():
    assert len(CATEGORIES) == 3
    assert len(PRODUCTS) == 12
    assert {p["category"] for p in PRODUCTS} <= {slug for _, slug in CATEGORIES}
    assert len({p["sku"] for p in PRODUCTS}) == 12
    assert len({p["slug"] for p in PRODUCTS}) == 12
    assert all(isinstance(p["price_cents"], int) and p["price_cents"] > 0 for p in PRODUCTS)


def test_seed_is_idempotent():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    assert seed(engine) == 12
    assert seed(engine) == 0
