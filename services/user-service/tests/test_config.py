import pytest

from app.core.config import load_settings


def test_missing_jwt_secret_fails_fast_without_leaking_values(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:super-secret-pw@db/x")
    monkeypatch.delenv("JWT_SECRET", raising=False)
    with pytest.raises(SystemExit) as exc:
        load_settings()
    message = str(exc.value)
    assert "JWT_SECRET" in message
    assert "super-secret-pw" not in message


def test_short_jwt_secret_is_rejected(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "too-short")
    with pytest.raises(SystemExit) as exc:
        load_settings()
    assert "too-short" not in str(exc.value)
