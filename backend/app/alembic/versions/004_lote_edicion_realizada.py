"""Add lote.edicion_realizada for single-edit workflow

Revision ID: 004_lote_edicion_realizada
Revises: 003_change_nit_to_rif
Create Date: 2026-04-04

"""
from alembic import op
import sqlalchemy as sa


revision = "004_lote_edicion_realizada"
down_revision = "003_change_nit_to_rif"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "lote",
        sa.Column(
            "edicion_realizada",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("lote", "edicion_realizada")
