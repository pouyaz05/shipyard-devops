import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.clients.cart_client import CartClient, CartLine, get_cart_client
from app.clients.errors import InsufficientStock, ProductNotFound, UpstreamUnavailable
from app.clients.product_client import ProductClient, get_product_client
from app.core.db import get_db
from app.core.deps import Principal, get_current_user_id, get_principal
from app.models import Order, OrderItem, OrderStatus
from app.schemas.order import CreateOrderRequest, OrderOut

logger = logging.getLogger("order-service")
router = APIRouter(prefix="/api/order-service/orders", tags=["orders"])


def _dollars(cents: int) -> str:
    return f"${cents // 100}.{cents % 100:02d}"


def _get_owned_order(db: Session, order_id: uuid.UUID, user_id: uuid.UUID) -> Order:
    order = db.scalar(select(Order).where(Order.id == order_id, Order.user_id == user_id))
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def _read_cart(carts: CartClient, token: str) -> list[CartLine]:
    try:
        lines = carts.get_cart(token)
    except UpstreamUnavailable as exc:
        logger.warning("cart-service call failed: %s", exc)
        raise HTTPException(status_code=502, detail="Cart service unavailable") from None
    if not lines:
        raise HTTPException(status_code=400, detail="Cart is empty")
    return lines


def _check_prices_and_stock(products: ProductClient, lines: list[CartLine]) -> None:
    for line in lines:
        try:
            product = products.get_product(line.product_id)
        except ProductNotFound:
            raise HTTPException(
                status_code=409, detail=f"'{line.product_name}' is no longer available"
            ) from None
        except UpstreamUnavailable as exc:
            logger.warning("product-service call failed: %s", exc)
            raise HTTPException(status_code=502, detail="Product service unavailable") from None
        if product.price_cents != line.unit_price_cents:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Price changed for '{line.product_name}': it was "
                    f"{_dollars(line.unit_price_cents)} in your cart and is now "
                    f"{_dollars(product.price_cents)}. Review your cart and try again."
                ),
            )
        if product.stock < line.quantity:
            raise HTTPException(
                status_code=409, detail=f"Insufficient stock for '{line.product_name}'"
            )


def _compensate(products: ProductClient, lines: list[CartLine]) -> None:
    """Undo earlier decrements. Best effort: a failure here is logged, never raised."""
    for line in reversed(lines):
        try:
            products.increment(line.product_id, line.quantity)
        except (UpstreamUnavailable, ProductNotFound) as exc:
            logger.error(
                "compensation failed, stock may be inconsistent: product_id=%s quantity=%s reason=%s",
                line.product_id,
                line.quantity,
                exc,
            )


def _reserve_stock(products: ProductClient, lines: list[CartLine]) -> None:
    done: list[CartLine] = []
    for line in lines:
        try:
            products.decrement(line.product_id, line.quantity)
            done.append(line)
        except InsufficientStock:
            _compensate(products, done)
            raise HTTPException(
                status_code=409, detail=f"Insufficient stock for '{line.product_name}'"
            ) from None
        except ProductNotFound:
            _compensate(products, done)
            raise HTTPException(
                status_code=409, detail=f"'{line.product_name}' is no longer available"
            ) from None
        except UpstreamUnavailable as exc:
            logger.warning("product-service call failed: %s", exc)
            _compensate(products, done)
            raise HTTPException(status_code=502, detail="Product service unavailable") from None


def _save_order(
    db: Session, user_id: uuid.UUID, payload: CreateOrderRequest, lines: list[CartLine]
) -> Order:
    order = Order(
        user_id=user_id,
        status=OrderStatus.PENDING_PAYMENT.value,
        total_cents=sum(line.unit_price_cents * line.quantity for line in lines),
        shipping_name=payload.shipping_name,
        shipping_address=payload.shipping_address,
        shipping_city=payload.shipping_city,
    )
    order.items = [
        OrderItem(
            product_id=line.product_id,
            product_name=line.product_name,
            unit_price_cents=line.unit_price_cents,
            quantity=line.quantity,
        )
        for line in lines
    ]
    db.add(order)
    db.commit()
    return order


@router.post("", response_model=OrderOut, status_code=201)
def create_order(
    payload: CreateOrderRequest,
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
    carts: CartClient = Depends(get_cart_client),
    products: ProductClient = Depends(get_product_client),
) -> Order:
    # Steps 1 to 3 only talk HTTP. The database is first used in step 4 and is
    # never held open during a call to another service.
    lines = _read_cart(carts, principal.token)
    _check_prices_and_stock(products, lines)
    _reserve_stock(products, lines)
    try:
        order = _save_order(db, principal.user_id, payload, lines)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error("could not save the order (%s), restoring stock", type(exc).__name__)
        _compensate(products, lines)
        raise HTTPException(status_code=500, detail="Could not create the order") from None
    try:
        carts.clear_cart(principal.token)
    except UpstreamUnavailable as exc:
        logger.warning("order %s created but the cart could not be cleared: %s", order.id, exc)
    return order


@router.get("", response_model=list[OrderOut])
def list_orders(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> list[Order]:
    stmt = (
        select(Order)
        .where(Order.user_id == user_id)
        .order_by(Order.created_at.desc(), Order.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt).all())


@router.get("/{order_id}", response_model=OrderOut)
def get_order(
    order_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> Order:
    return _get_owned_order(db, order_id, user_id)


@router.post("/{order_id}/pay", response_model=OrderOut)
def pay_order(
    order_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> Order:
    """Simulated payment. A conditional UPDATE keeps two parallel requests from both succeeding."""
    table = Order.__table__
    paid = db.execute(
        update(table)
        .where(
            table.c.id == order_id,
            table.c.user_id == user_id,
            table.c.status == OrderStatus.PENDING_PAYMENT.value,
        )
        .values(status=OrderStatus.PAID.value)
        .returning(table.c.id)
    ).scalar_one_or_none()
    db.commit()
    order = _get_owned_order(db, order_id, user_id)  # 404 for unknown or someone else's order
    if paid is None:
        raise HTTPException(status_code=409, detail="Order is not awaiting payment")
    return order
