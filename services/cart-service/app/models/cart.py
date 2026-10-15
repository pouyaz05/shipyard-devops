import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Cart(Base):
    __tablename__ = "carts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, unique=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, server_default=func.now()
    )

    items: Mapped[list["CartItem"]] = relationship(
        back_populates="cart", cascade="all, delete-orphan", lazy="selectin"
    )


class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (
        UniqueConstraint("cart_id", "product_id", name="uq_cart_items_cart_id_product_id"),
        CheckConstraint("quantity >= 1", name="quantity_positive"),
        CheckConstraint("unit_price_cents >= 0", name="unit_price_non_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    cart_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("carts.id", ondelete="CASCADE"), nullable=False
    )
    # Snapshot of product-service data. product-service stays the source of truth.
    product_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    unit_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    cart: Mapped[Cart] = relationship(back_populates="items")
