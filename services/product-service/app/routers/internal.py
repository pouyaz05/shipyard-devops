import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import require_internal
from app.models import Product
from app.services.stock import decrement_stock, increment_stock

router = APIRouter(
    prefix="/internal/products",
    tags=["internal"],
    include_in_schema=False,
    dependencies=[Depends(require_internal)],
)


class QuantityIn(BaseModel):
    quantity: int = Field(ge=1, le=1_000_000)


class StockOut(BaseModel):
    product_id: uuid.UUID
    stock: int


@router.post("/{product_id}/decrement", response_model=StockOut)
def decrement(product_id: uuid.UUID, payload: QuantityIn, db: Session = Depends(get_db)) -> StockOut:
    new_stock = decrement_stock(db, product_id, payload.quantity)
    if new_stock is None:
        db.rollback()
        if db.scalar(select(Product.id).where(Product.id == product_id)) is None:
            raise HTTPException(status_code=404, detail="Product not found")
        raise HTTPException(status_code=409, detail="Insufficient stock")
    db.commit()
    return StockOut(product_id=product_id, stock=new_stock)


@router.post("/{product_id}/increment", response_model=StockOut)
def increment(product_id: uuid.UUID, payload: QuantityIn, db: Session = Depends(get_db)) -> StockOut:
    new_stock = increment_stock(db, product_id, payload.quantity)
    if new_stock is None:
        db.rollback()
        raise HTTPException(status_code=404, detail="Product not found")
    db.commit()
    return StockOut(product_id=product_id, stock=new_stock)
