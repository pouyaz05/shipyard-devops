from sqlalchemy.exc import OperationalError

from app.core.db import get_db
from app.main import app


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_ok(client):
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_ready_returns_503_when_db_is_down(client):
    class BrokenSession:
        def execute(self, *args, **kwargs):
            raise OperationalError("SELECT 1", {}, Exception("db down"))

    def broken_db():
        yield BrokenSession()

    app.dependency_overrides[get_db] = broken_db
    response = client.get("/ready")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}
