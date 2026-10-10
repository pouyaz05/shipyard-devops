import secrets

from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader

from app.core.config import settings

_admin_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)


def require_admin(provided: str | None = Security(_admin_key_header)) -> None:
    """Temporary protection for write endpoints (replaced by roles later)."""
    expected = settings.ADMIN_API_KEY.encode()
    if provided is None or not secrets.compare_digest(provided.encode(), expected):
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")
