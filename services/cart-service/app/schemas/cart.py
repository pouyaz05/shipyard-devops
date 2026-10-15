import uuid

from pydantic import BaseModel, Field

MAX_QUANTITY = 1000


class AddItemRequest(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(ge=1, le=MAX_QUANTITY)


class UpdateItemRequest(BaseModel):
    quantity: int = Field(ge=1, le=MAX_QUANTITY)


class CartItemOut(BaseModel):
    product_id: uuid.UUID
    product_name: str
    unit_price_cents: int
    quantity: int
    line_total_cents: int


class CartOut(BaseModel):
    items: list[CartItemOut]
    total_cents: int
