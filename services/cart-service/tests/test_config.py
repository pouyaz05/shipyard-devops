import pytest

from app.core.config import load_settings


def test_missing_required_vars_fail_fast_without_leaking_values(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:super-secret-pw@db/x")
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("PRODUCT_SERVICE_URL", raising=False)
    with pytest.raises(SystemExit) as exc:
        load_settings()
    message = str(exc.value)
    assert "JWT_SECRET" in message
    assert "PRODUCT_SERVICE_URL" in message
    assert "super-secret-pw" not in message


def test_bad_product_service_url_is_rejected(monkeypatch):
    monkeypatch.setenv("PRODUCT_SERVICE_URL", "ftp://nope")
    with pytest.raises(SystemExit) as exc:
        load_settings()
    assert "PRODUCT_SERVICE_URL" in str(exc.value)
