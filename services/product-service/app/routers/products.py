import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import require_admin
from app.core.slug import slugify
from app.models import Category, Product
from app.schemas.product import ProductIn, ProductOut, ProductPage

router = APIRouter(prefix="/api/product-service/products", tags=["products"])

SortKey = Literal["created_at", "-created_at", "price", "-price"]
_ORDER = {  # id is a tie-breaker so pages stay stable
    "created_at": (Product.created_at.asc(), Product.id.asc()),
    "-created_at": (Product.created_at.desc(), Product.id.desc()),
    "price": (Product.price_cents.asc(), Product.id.asc()),
    "-price": (Product.price_cents.desc(), Product.id.desc()),
}


def _like_pattern(q: str) -> str:
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _get_or_404(db: Session, slug: str) -> Product:
    product = db.scalar(select(Product).where(Product.slug == slug))
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


def _category_or_422(db: Session, category_id: uuid.UUID) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=422, detail="Category not found")
    return category


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="SKU or slug already exists") from None


@router.get("", response_model=ProductPage)
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: str | None = Query(None, max_length=100, description="category slug"),
    q: str | None = Query(None, min_length=1, max_length=100, description="search in name"),
    sort: SortKey = "-created_at",
    db: Session = Depends(get_db),
) -> ProductPage:
    filters = []
    if category:
        filters.append(Product.category.has(Category.slug == category))
    if q:
        filters.append(Product.name.ilike(_like_pattern(q), escape="\\"))
    total = db.scalar(select(func.count()).select_from(Product).where(*filters)) or 0
    rows = db.scalars(
        select(Product)
        .where(*filters)
        .order_by(*_ORDER[sort])
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()
    return ProductPage(
        items=[ProductOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{slug}", response_model=ProductOut)
def get_product(slug: str, db: Session = Depends(get_db)) -> Product:
    return _get_or_404(db, slug)


@router.post("", response_model=ProductOut, status_code=201, dependencies=[Depends(require_admin)])
def create_product(payload: ProductIn, db: Session = Depends(get_db)) -> Product:
    category = _category_or_422(db, payload.category_id)
    product = Product(
        **payload.model_dump(exclude={"category_id", "slug"}),
        slug=payload.slug or slugify(payload.name),
        category=category,
    )
    db.add(product)
    _commit(db)
    return product


@router.put("/{slug}", response_model=ProductOut, dependencies=[Depends(require_admin)])
def update_product(slug: str, payload: ProductIn, db: Session = Depends(get_db)) -> Product:
    product = _get_or_404(db, slug)
    category = _category_or_422(db, payload.category_id)
    for field, value in payload.model_dump(exclude={"category_id", "slug"}).items():
        setattr(product, field, value)
    if payload.slug:  # slug omitted -> keep the current URL
        product.slug = payload.slug
    product.category = category
    _commit(db)
    return product


@router.delete("/{slug}", status_code=204, dependencies=[Depends(require_admin)])
def delete_product(slug: str, db: Session = Depends(get_db)) -> None:
    product = _get_or_404(db, slug)
    db.delete(product)
    db.commit()


@router.get("/by-id/{product_id}", response_model=ProductOut)
def get_product_by_id(product_id: uuid.UUID, db: Session = Depends(get_db)) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product
