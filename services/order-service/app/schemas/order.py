import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field


class CreateOrderRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    shipping_name: str = Field(min_length=1, max_length=255)
    shipping_address: str = Field(min_length=1, max_length=500)
    shipping_city: str = Field(min_length=1, max_length=255)


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: uuid.UUID
    product_name: str
    unit_price_cents: int
    quantity: int

    @computed_field  # type: ignore[prop-decorator]
    @property
    def line_total_cents(self) -> int:
        return self.unit_price_cents * self.quantity


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: str
    total_cents: int
    shipping_name: str
    shipping_address: str
    shipping_city: str
    created_at: datetime
    items: list[OrderItemOut]
