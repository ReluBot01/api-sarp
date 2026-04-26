"""Add orden column to lote_proveedor for display order

Revision ID: 007_lote_proveedor_orden
Revises: 006_producto_retirado
Create Date: 2026-04-19

"""
from alembic import op
import sqlalchemy as sa


revision = "007_lote_proveedor_orden"
down_revision = "006_producto_retirado"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "lote_proveedor",
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("lote_proveedor", "orden")
