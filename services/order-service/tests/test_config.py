import pytest

from app.core.config import load_settings

REQUIRED = ["JWT_SECRET", "CART_SERVICE_URL", "PRODUCT_SERVICE_URL", "INTERNAL_API_KEY"]


def test_missing_required_vars_fail_fast_without_leaking_values(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:super-secret-pw@db/x")
    for name in REQUIRED:
        monkeypatch.delenv(name, raising=False)
    with pytest.raises(SystemExit) as exc:
        load_settings()
    message = str(exc.value)
    for name in REQUIRED:
        assert name in message
    assert "super-secret-pw" not in message


@pytest.mark.parametrize("name", ["CART_SERVICE_URL", "PRODUCT_SERVICE_URL"])
def test_bad_service_url_is_rejected(monkeypatch, name):
    monkeypatch.setenv(name, "ftp://nope")
    with pytest.raises(SystemExit) as exc:
        load_settings()
    assert name in str(exc.value)


@pytest.mark.parametrize("name", ["JWT_SECRET", "INTERNAL_API_KEY"])
def test_short_secret_is_rejected_without_leaking_it(monkeypatch, name):
    monkeypatch.setenv(name, "too-short")
    with pytest.raises(SystemExit) as exc:
        load_settings()
    message = str(exc.value)
    assert name in message
    assert "too-short" not in message
