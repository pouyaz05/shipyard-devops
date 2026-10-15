import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.clients.product_client import (
    ProductClient,
    ProductInfo,
    ProductNotFound,
    ProductServiceUnavailable,
    get_product_client,
)
from app.core.db import get_db
from app.core.deps import get_current_user_id
from app.models import Cart, CartItem
from app.schemas.cart import AddItemRequest, CartItemOut, CartOut, UpdateItemRequest

logger = logging.getLogger("cart-service")
router = APIRouter(prefix="/api/cart-service/cart", tags=["cart"])


def _find_cart(db: Session, user_id: uuid.UUID) -> Cart | None:
    return db.scalar(select(Cart).where(Cart.user_id == user_id))


def _get_or_create_cart(db: Session, user_id: uuid.UUID) -> Cart:
    cart = _find_cart(db, user_id)
    if cart is None:
        cart = Cart(user_id=user_id)
        db.add(cart)
        try:
            db.flush()
        except IntegrityError:  # another request created the cart first
            db.rollback()
            cart = _find_cart(db, user_id)
            if cart is None:
                raise
    return cart


def _find_item(cart: Cart | None, product_id: uuid.UUID) -> CartItem | None:
    if cart is None:
        return None
    return next((i for i in cart.items if i.product_id == product_id), None)


def _fetch_product(client: ProductClient, product_id: uuid.UUID) -> ProductInfo:
    try:
        return client.get_product(product_id)
    except ProductNotFound:
        raise HTTPException(status_code=404, detail="Product not found") from None
    except ProductServiceUnavailable as exc:
        logger.warning("product-service call failed: %s", exc)
        raise HTTPException(status_code=502, detail="Product service unavailable") from None


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Cart was modified concurrently, retry"
        ) from None


def _cart_out(cart: Cart | None) -> CartOut:
    items = sorted(cart.items, key=lambda i: (i.product_name, str(i.product_id))) if cart else []
    out = [
        CartItemOut(
            product_id=i.product_id,
            product_name=i.product_name,
            unit_price_cents=i.unit_price_cents,
            quantity=i.quantity,
            line_total_cents=i.unit_price_cents * i.quantity,
        )
        for i in items
    ]
    return CartOut(items=out, total_cents=sum(i.line_total_cents for i in out))


def _touch(cart: Cart) -> None:
    cart.updated_at = datetime.now(timezone.utc)


@router.get("", response_model=CartOut)
def get_cart(
    user_id: uuid.UUID = Depends(get_current_user_id), db: Session = Depends(get_db)
) -> CartOut:
    return _cart_out(_find_cart(db, user_id))


@router.post("/items", response_model=CartOut, status_code=201)
def add_item(
    payload: AddItemRequest,
    response: Response,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    products: ProductClient = Depends(get_product_client),
) -> CartOut:
    product = _fetch_product(products, payload.product_id)  # 404 / 502 before touching the DB
    cart = _get_or_create_cart(db, user_id)
    item = _find_item(cart, payload.product_id)
    new_quantity = payload.quantity + (item.quantity if item else 0)
    if new_quantity > product.stock:
        raise HTTPException(status_code=409, detail="Insufficient stock")
    if item is None:
        cart.items.append(
            CartItem(
                product_id=product.id,
                product_name=product.name,
                unit_price_cents=product.price_cents,
                quantity=new_quantity,
            )
        )
    else:  # same product again: sum the quantity and refresh the snapshot
        item.product_name = product.name
        item.unit_price_cents = product.price_cents
        item.quantity = new_quantity
        response.status_code = 200
    _touch(cart)
    _commit(db)
    return _cart_out(cart)


@router.patch("/items/{product_id}", response_model=CartOut)
def update_item(
    product_id: uuid.UUID,
    payload: UpdateItemRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    products: ProductClient = Depends(get_product_client),
) -> CartOut:
    cart = _find_cart(db, user_id)
    item = _find_item(cart, product_id)
    if cart is None or item is None:
        raise HTTPException(status_code=404, detail="Item not in cart")
    if payload.quantity > item.quantity:  # only an increase needs a stock check
        product = _fetch_product(products, product_id)
        if payload.quantity > product.stock:
            raise HTTPException(status_code=409, detail="Insufficient stock")
        item.product_name = product.name
        item.unit_price_cents = product.price_cents
    item.quantity = payload.quantity
    _touch(cart)
    _commit(db)
    return _cart_out(cart)


@router.delete("/items/{product_id}", status_code=204)
def delete_item(
    product_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> None:
    cart = _find_cart(db, user_id)
    item = _find_item(cart, product_id)
    if cart is None or item is None:
        raise HTTPException(status_code=404, detail="Item not in cart")
    cart.items.remove(item)
    _touch(cart)
    _commit(db)


@router.delete("", status_code=204)
def clear_cart(
    user_id: uuid.UUID = Depends(get_current_user_id), db: Session = Depends(get_db)
) -> None:
    cart = _find_cart(db, user_id)
    if cart is not None:
        cart.items.clear()
        _touch(cart)
        _commit(db)
