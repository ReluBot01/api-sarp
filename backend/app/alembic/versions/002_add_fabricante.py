"""Add fabricante table and id_fabricante column

Revision ID: 002_add_fabricante
Revises: 001_initial_schema
Create Date: 2026-01-27

Nota: 001_initial_schema ya puede incluir fabricante e id_fabricante en producto.
Esta revisión es idempotente para no fallar en bases nuevas ni en migraciones parciales.

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = "002_add_fabricante"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)

    if not insp.has_table("fabricante"):
        op.create_table(
            "fabricante",
            sa.Column("id_fabricante", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("nombre", sa.String(length=255), nullable=False),
            sa.Column("rif", sa.String(length=50), nullable=False),
            sa.Column("contacto", sa.String(length=100), nullable=True),
            sa.Column("telefono", sa.String(length=50), nullable=True),
            sa.Column("email", sa.String(length=255), nullable=True),
            sa.Column("direccion", sa.String(length=500), nullable=True),
            sa.Column("estado", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("fecha_creacion", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_fabricante_nombre", "fabricante", ["nombre"])
        op.create_index("ix_fabricante_rif", "fabricante", ["rif"], unique=True)

    producto_cols = {c["name"] for c in insp.get_columns("producto")}
    if "id_fabricante" not in producto_cols:
        op.add_column("producto", sa.Column("id_fabricante", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_producto_fabricante",
            "producto",
            "fabricante",
            ["id_fabricante"],
            ["id_fabricante"],
        )
        op.create_index("ix_producto_fabricante", "producto", ["id_fabricante"])
    else:
        # Asegurar índice si faltara (BD antigua parcial)
        insp2 = inspect(conn)
        idx_names = {i["name"] for i in insp2.get_indexes("producto")}
        if "ix_producto_fabricante" not in idx_names:
            op.create_index("ix_producto_fabricante", "producto", ["id_fabricante"])


def downgrade() -> None:
    # 001_initial_schema ya define fabricante e id_fabricante; revertir aquí rompería ese esquema.
    # Mantener vacío de forma intencional.
    pass
