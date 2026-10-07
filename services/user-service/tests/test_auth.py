import time
import uuid

import jwt

from app.core.config import settings

REGISTER = "/api/user-service/auth/register"
LOGIN = "/api/user-service/auth/login"
ME = "/api/user-service/users/me"


def user_payload(**overrides):
    data = {"email": "alice@example.com", "password": "correct-horse", "full_name": "Alice Doe"}
    data.update(overrides)
    return data


def login(client, email="alice@example.com", password="correct-horse"):
    return client.post(LOGIN, json={"email": email, "password": password})


def get_token(client) -> str:
    client.post(REGISTER, json=user_payload())
    return login(client).json()["access_token"]


def test_register_success(client):
    response = client.post(REGISTER, json=user_payload())
    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"id", "email", "full_name"}
    assert body["email"] == "alice@example.com"
    assert body["full_name"] == "Alice Doe"
    uuid.UUID(body["id"])


def test_register_lowercases_email(client):
    response = client.post(REGISTER, json=user_payload(email="Alice@Example.COM"))
    assert response.status_code == 201
    assert response.json()["email"] == "alice@example.com"


def test_register_duplicate_email(client):
    client.post(REGISTER, json=user_payload())
    response = client.post(REGISTER, json=user_payload(email="ALICE@example.com"))
    assert response.status_code == 409
    assert response.json() == {"detail": "Email already registered"}


def test_register_short_password(client):
    response = client.post(REGISTER, json=user_payload(password="short"))
    assert response.status_code == 422


def test_login_success(client):
    client.post(REGISTER, json=user_payload())
    response = login(client)
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == settings.JWT_EXPIRE_MINUTES * 60
    claims = jwt.decode(body["access_token"], settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    uuid.UUID(claims["sub"])


def test_login_wrong_password(client):
    client.post(REGISTER, json=user_payload())
    response = login(client, password="wrong-password")
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid credentials"}


def test_login_unknown_email_gives_same_error(client):
    response = login(client, email="nobody@example.com")
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid credentials"}


def test_me_with_valid_token(client):
    token = get_token(client)
    response = client.get(ME, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"id", "email", "full_name"}
    assert body["email"] == "alice@example.com"


def test_me_without_token(client):
    assert client.get(ME).status_code == 401


def test_me_with_invalid_token(client):
    response = client.get(ME, headers={"Authorization": "Bearer not-a-token"})
    assert response.status_code == 401


def test_me_with_expired_token(client):
    expired = jwt.encode(
        {"sub": str(uuid.uuid4()), "exp": int(time.time()) - 10},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    response = client.get(ME, headers={"Authorization": f"Bearer {expired}"})
    assert response.status_code == 401


def test_me_with_token_signed_by_other_secret(client):
    forged = jwt.encode(
        {"sub": str(uuid.uuid4()), "exp": int(time.time()) + 600},
        "x" * 40,
        algorithm="HS256",
    )
    response = client.get(ME, headers={"Authorization": f"Bearer {forged}"})
    assert response.status_code == 401
