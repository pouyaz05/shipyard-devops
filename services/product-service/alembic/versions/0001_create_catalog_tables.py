"""create categories and products tables

Revision ID: 0001
Revises:
Create Date: 2026-10-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "categories",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_categories")),
        sa.UniqueConstraint("slug", name=op.f("uq_categories_slug")),
    )
    op.create_table(
        "products",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("sku", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="USD", nullable=False),
        sa.Column("stock", sa.Integer(), server_default="0", nullable=False),
        sa.Column("category_id", sa.Uuid(), nullable=False),
        sa.Column("image_url", sa.String(length=2048), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("price_cents >= 0", name=op.f("ck_products_price_cents_non_negative")),
        sa.CheckConstraint("stock >= 0", name=op.f("ck_products_stock_non_negative")),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
            name=op.f("fk_products_category_id_categories"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_products")),
        sa.UniqueConstraint("sku", name=op.f("uq_products_sku")),
        sa.UniqueConstraint("slug", name=op.f("uq_products_slug")),
    )
    op.create_index(op.f("ix_products_category_id"), "products", ["category_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_products_category_id"), table_name="products")
    op.drop_table("products")
    op.drop_table("categories")
