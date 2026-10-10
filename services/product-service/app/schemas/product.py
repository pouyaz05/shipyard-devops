import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.category import CategoryOut

SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


class ProductIn(BaseModel):
    """Body for POST (create) and PUT (full replace)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    sku: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255, pattern=SLUG_PATTERN)
    description: str | None = Field(default=None, max_length=10000)
    price_cents: int = Field(ge=0, le=2_000_000_000)
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    stock: int = Field(default=0, ge=0, le=1_000_000_000)
    category_id: uuid.UUID
    image_url: str | None = Field(default=None, max_length=2048)

    @field_validator("image_url")
    @classmethod
    def check_image_url(cls, value: str | None) -> str | None:
        if value is not None and not value.startswith(("https://", "http://", "/")):
            raise ValueError("image_url must start with https://, http:// or /")
        return value


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sku: str
    name: str
    slug: str
    description: str | None
    price_cents: int
    currency: str
    stock: int
    category: CategoryOut
    image_url: str | None
    created_at: datetime


class ProductPage(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    page_size: int
