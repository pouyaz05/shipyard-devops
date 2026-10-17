import uuid

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models import Product

_products = Product.__table__


def decrement_stock(db: Session, product_id: uuid.UUID, quantity: int) -> int | None:
    """UPDATE ... SET stock = stock - n WHERE id = :id AND stock >= n.

    Returns the new stock, or None if no row was updated (unknown product or not enough stock).
    The caller commits.
    """
    stmt = (
        update(_products)
        .where(_products.c.id == product_id, _products.c.stock >= quantity)
        .values(stock=_products.c.stock - quantity)
        .returning(_products.c.stock)
    )
    return db.execute(stmt).scalar_one_or_none()


def increment_stock(db: Session, product_id: uuid.UUID, quantity: int) -> int | None:
    """Atomic increment (used to compensate a decrement). Returns the new stock or None."""
    stmt = (
        update(_products)
        .where(_products.c.id == product_id)
        .values(stock=_products.c.stock + quantity)
        .returning(_products.c.stock)
    )
    return db.execute(stmt).scalar_one_or_none()
