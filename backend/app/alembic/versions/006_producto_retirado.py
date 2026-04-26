"""Producto retirado (fuera de alertas de vencimiento)

Revision ID: 006_producto_retirado
Revises: 005_add_lote_proveedor_link
Create Date: 2026-04-19

"""
from alembic import op
import sqlalchemy as sa


revision = "006_producto_retirado"
down_revision = "005_add_lote_proveedor_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "producto",
        sa.Column(
            "retirado",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "producto",
        sa.Column("fecha_retiro", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("producto", "fecha_retiro")
    op.drop_column("producto", "retirado")
