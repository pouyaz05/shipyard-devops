import secrets

from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader

from app.core.config import settings

_admin_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)
_internal_key_header = APIKeyHeader(name="X-Internal-Key", auto_error=False)


def _matches(provided: str | None, expected: str) -> bool:
    return provided is not None and secrets.compare_digest(provided.encode(), expected.encode())


def require_admin(provided: str | None = Security(_admin_key_header)) -> None:
    """Temporary protection for write endpoints (replaced by roles later)."""
    if not _matches(provided, settings.ADMIN_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")


def require_internal(provided: str | None = Security(_internal_key_header)) -> None:
    """Protects /internal endpoints (service-to-service only)."""
    if not _matches(provided, settings.INTERNAL_API_KEY):
        raise HTTPException(status_code=403, detail="Invalid or missing internal key")
