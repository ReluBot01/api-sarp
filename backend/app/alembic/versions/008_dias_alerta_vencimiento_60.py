"""Alertas de vencimiento: valor por defecto 60 días (antes 30)

Revision ID: 008_dias_alerta_vencimiento_60
Revises: 007_lote_proveedor_orden
Create Date: 2026-04-19

"""
from alembic import op
import sqlalchemy as sa


revision = "008_dias_alerta_vencimiento_60"
down_revision = "007_lote_proveedor_orden"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Actualiza instalaciones que aún tienen el valor histórico por defecto
    op.execute(
        sa.text(
            "UPDATE configuracion_sistema SET dias_alerta_vencimiento = 60 "
            "WHERE dias_alerta_vencimiento = 30"
        )
    )


def downgrade() -> None:
    # No revertimos datos: un valor 60 podría ser elección explícita del usuario
    pass
