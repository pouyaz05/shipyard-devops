import pytest

from app.core.config import load_settings


def test_missing_admin_key_fails_fast_without_leaking_values(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:super-secret-pw@db/x")
    monkeypatch.delenv("ADMIN_API_KEY", raising=False)
    with pytest.raises(SystemExit) as exc:
        load_settings()
    message = str(exc.value)
    assert "ADMIN_API_KEY" in message
    assert "super-secret-pw" not in message


def test_short_admin_key_is_rejected(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "too-short")
    with pytest.raises(SystemExit) as exc:
        load_settings()
    assert "too-short" not in str(exc.value)


def test_missing_internal_key_fails_fast(monkeypatch):
    monkeypatch.delenv("INTERNAL_API_KEY", raising=False)
    with pytest.raises(SystemExit) as exc:
        load_settings()
    assert "INTERNAL_API_KEY" in str(exc.value)


def test_short_internal_key_is_rejected(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_KEY", "too-short")
    with pytest.raises(SystemExit) as exc:
        load_settings()
    assert "too-short" not in str(exc.value)
