import uuid

import jwt

from app.core.config import settings


def decode_user_id(token: str) -> uuid.UUID | None:
    """Verify a token issued by user-service and return the user id from `sub`."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
        sub = payload.get("sub")
        return uuid.UUID(sub) if isinstance(sub, str) else None
    except (jwt.PyJWTError, ValueError):
        return None
