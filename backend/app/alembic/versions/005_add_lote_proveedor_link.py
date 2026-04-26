"""Add lote_proveedor relation table for many-to-many providers

Revision ID: 005_add_lote_proveedor_link
Revises: 004_lote_edicion_realizada
Create Date: 2026-04-19

"""
from alembic import op
import sqlalchemy as sa


revision = "005_add_lote_proveedor_link"
down_revision = "004_lote_edicion_realizada"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lote_proveedor",
        sa.Column("id_lote", sa.Integer(), nullable=False),
        sa.Column("id_proveedor", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["id_lote"], ["lote.id_lote"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_proveedor"], ["proveedor.id_proveedor"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_lote", "id_proveedor"),
    )
    op.create_index(
        "ix_lote_proveedor_id_proveedor",
        "lote_proveedor",
        ["id_proveedor"],
    )
    op.execute(
        sa.text(
            """
            INSERT INTO lote_proveedor (id_lote, id_proveedor)
            SELECT id_lote, id_proveedor
            FROM lote
            WHERE id_proveedor IS NOT NULL
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_lote_proveedor_id_proveedor", table_name="lote_proveedor")
    op.drop_table("lote_proveedor")
