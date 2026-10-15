import uuid

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_user_id

_bearer = HTTPBearer(auto_error=False)


def get_current_user_id(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> uuid.UUID:
    user_id = decode_user_id(creds.credentials) if creds else None
    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_id
