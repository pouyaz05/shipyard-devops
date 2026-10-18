import uuid
from dataclasses import dataclass

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_user_id

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    """The authenticated caller. The raw token is kept so it can be forwarded to cart-service."""

    user_id: uuid.UUID
    token: str


def get_principal(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> Principal:
    user_id = decode_user_id(creds.credentials) if creds else None
    if creds is None or user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return Principal(user_id=user_id, token=creds.credentials)


def get_current_user_id(principal: Principal = Depends(get_principal)) -> uuid.UUID:
    return principal.user_id
