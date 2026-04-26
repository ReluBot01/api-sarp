"""Change nit to rif in proveedor table

Revision ID: 003_change_nit_to_rif
Revises: 002_add_fabricante
Create Date: 2026-01-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003_change_nit_to_rif'
down_revision = '002_add_fabricante'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename column nit to rif in proveedor table
    op.alter_column('proveedor', 'nit', new_column_name='rif')
    
    # Update index name if it exists
    try:
        op.drop_index('ix_proveedor_nit', table_name='proveedor')
        op.create_index('ix_proveedor_rif', 'proveedor', ['rif'], unique=True)
    except:
        # If index doesn't exist, create it
        op.create_index('ix_proveedor_rif', 'proveedor', ['rif'], unique=True)


def downgrade() -> None:
    # Revert: rename rif back to nit
    op.alter_column('proveedor', 'rif', new_column_name='nit')
    
    # Update index name back
    try:
        op.drop_index('ix_proveedor_rif', table_name='proveedor')
        op.create_index('ix_proveedor_nit', 'proveedor', ['nit'], unique=True)
    except:
        op.create_index('ix_proveedor_nit', 'proveedor', ['nit'], unique=True)
