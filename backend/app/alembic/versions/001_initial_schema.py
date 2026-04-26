"""Initial schema - Simplified warehouse inventory system

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-01-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ensure uuid-ossp extension is available
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    
    # =============================================================================
    # CONFIGURACIÓN DEL SISTEMA
    # =============================================================================
    op.create_table(
        'configuracion_sistema',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('nombre_almacen', sa.String(length=255), nullable=False, server_default='Almacén Principal'),
        sa.Column('dias_alerta_vencimiento', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('unidad_peso_defecto', sa.String(length=50), nullable=False, server_default='kg'),
        sa.Column('fecha_actualizacion', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    
    # =============================================================================
    # USUARIO
    # =============================================================================
    op.create_table(
        'user',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_superuser', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('fecha_creacion', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_user_email', 'user', ['email'], unique=True)
    
    # =============================================================================
    # ITEM (Legacy - para compatibilidad)
    # =============================================================================
    op.create_table(
        'item',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['user.id'], ondelete='CASCADE'),
    )
    
    # =============================================================================
    # PROVEEDOR
    # =============================================================================
    op.create_table(
        'proveedor',
        sa.Column('id_proveedor', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('nombre', sa.String(length=255), nullable=False),
        sa.Column('nit', sa.String(length=50), nullable=False),
        sa.Column('telefono', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('direccion', sa.String(length=500), nullable=False),
        sa.Column('ciudad', sa.String(length=100), nullable=False),
        sa.Column('estado', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('fecha_creacion', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_proveedor_nit', 'proveedor', ['nit'], unique=True)
    
    # =============================================================================
    # FABRICANTE - Empresas que elaboran los productos
    # =============================================================================
    op.create_table(
        'fabricante',
        sa.Column('id_fabricante', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('nombre', sa.String(length=255), nullable=False),
        sa.Column('rif', sa.String(length=50), nullable=False),
        sa.Column('contacto', sa.String(length=100), nullable=True),
        sa.Column('telefono', sa.String(length=50), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('direccion', sa.String(length=500), nullable=True),
        sa.Column('estado', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('fecha_creacion', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_fabricante_nombre', 'fabricante', ['nombre'])
    op.create_index('ix_fabricante_rif', 'fabricante', ['rif'], unique=True)
    
    # =============================================================================
    # LOTE - Registro de llegada de carga
    # =============================================================================
    op.create_table(
        'lote',
        sa.Column('id_lote', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('numero_lote', sa.String(length=100), nullable=False),
        sa.Column('fecha_llegada', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('fecha_registro', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('estado', sa.String(length=50), nullable=False, server_default='Activo'),
        sa.Column('peso_total_recibido', sa.Float(), nullable=False, server_default='0'),
        sa.Column('unidad_peso', sa.String(length=50), nullable=False, server_default='kg'),
        sa.Column('observaciones', sa.String(length=1000), nullable=True),
        sa.Column('id_proveedor', sa.Integer(), nullable=False),
        sa.Column('id_usuario_recepcion', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['id_proveedor'], ['proveedor.id_proveedor']),
        sa.ForeignKeyConstraint(['id_usuario_recepcion'], ['user.id']),
    )
    op.create_index('ix_lote_numero', 'lote', ['numero_lote'])
    op.create_index('ix_lote_proveedor', 'lote', ['id_proveedor'])
    op.create_index('ix_lote_fecha_llegada', 'lote', ['fecha_llegada'])
    
    # =============================================================================
    # PRODUCTO - Con todos los campos de la ficha de recepción
    # =============================================================================
    op.create_table(
        'producto',
        sa.Column('id_producto', sa.Integer(), primary_key=True, autoincrement=True),
        # Información básica
        sa.Column('nombre', sa.String(length=255), nullable=False),
        sa.Column('categoria', sa.String(length=100), nullable=False, server_default='Otros'),
        # Fabricante
        sa.Column('id_fabricante', sa.Integer(), nullable=True),
        sa.Column('elaborado_por', sa.String(length=255), nullable=True),
        # Marca y presentación
        sa.Column('marca', sa.String(length=100), nullable=True),
        sa.Column('presentacion', sa.String(length=150), nullable=True),
        # Lote del producto (del fabricante)
        sa.Column('lote_producto', sa.String(length=100), nullable=True),
        # Fechas
        sa.Column('fecha_elaboracion', sa.Date(), nullable=True),
        sa.Column('fecha_vencimiento', sa.Date(), nullable=True),
        # Uso y condición
        sa.Column('uso_recomendado', sa.String(length=100), nullable=False, server_default='PC DIRECTO HUMANO (PCDH)'),
        sa.Column('condicion', sa.String(length=100), nullable=False, server_default='OPTIMAS CONDICIONES'),
        # Cantidades
        sa.Column('cantidad_tm', sa.Float(), nullable=False, server_default='0'),
        sa.Column('cantidad_kg', sa.Float(), nullable=False, server_default='0'),
        sa.Column('unidades', sa.Integer(), nullable=False, server_default='0'),
        # Control de calidad
        sa.Column('estado_calidad', sa.String(length=50), nullable=False, server_default='Aprobado'),
        sa.Column('apto_consumo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('motivo_rechazo', sa.String(length=500), nullable=True),
        # Stock mínimo
        sa.Column('stock_minimo', sa.Integer(), nullable=False, server_default='0'),
        # Campos opcionales
        sa.Column('descripcion', sa.String(length=500), nullable=True),
        sa.Column('codigo_interno', sa.String(length=50), nullable=True),
        sa.Column('codigo_barras', sa.String(length=50), nullable=True),
        # Estado
        sa.Column('estado', sa.Boolean(), nullable=False, server_default='true'),
        # Relación con lote de recepción
        sa.Column('id_lote', sa.Integer(), nullable=False),
        sa.Column('fecha_creacion', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['id_lote'], ['lote.id_lote']),
        sa.ForeignKeyConstraint(['id_fabricante'], ['fabricante.id_fabricante']),
    )
    op.create_index('ix_producto_nombre', 'producto', ['nombre'])
    op.create_index('ix_producto_fabricante', 'producto', ['id_fabricante'])
    op.create_index('ix_producto_categoria', 'producto', ['categoria'])
    op.create_index('ix_producto_codigo_interno', 'producto', ['codigo_interno'])
    op.create_index('ix_producto_codigo_barras', 'producto', ['codigo_barras'])
    op.create_index('ix_producto_lote', 'producto', ['id_lote'])
    op.create_index('ix_producto_fecha_vencimiento', 'producto', ['fecha_vencimiento'])
    op.create_index('ix_producto_lote_producto', 'producto', ['lote_producto'])
    
    # =============================================================================
    # AUDITORÍA
    # =============================================================================
    op.create_table(
        'auditoria',
        sa.Column('id_auditoria', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('entidad_afectada', sa.String(length=100), nullable=False),
        sa.Column('id_registro_afectado', sa.String(length=100), nullable=False),
        sa.Column('accion', sa.String(length=50), nullable=False),
        sa.Column('detalle', postgresql.JSON(), nullable=True, server_default='{}'),
        sa.Column('resultado', sa.String(length=50), nullable=False, server_default='Éxito'),
        sa.Column('id_usuario', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('fecha_accion', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['id_usuario'], ['user.id']),
    )
    op.create_index('ix_auditoria_entidad', 'auditoria', ['entidad_afectada'])
    op.create_index('ix_auditoria_fecha', 'auditoria', ['fecha_accion'])
    op.create_index('ix_auditoria_usuario', 'auditoria', ['id_usuario'])


def downgrade() -> None:
    op.drop_table('auditoria')
    op.drop_table('producto')
    op.drop_table('lote')
    op.drop_table('fabricante')
    op.drop_table('proveedor')
    op.drop_table('item')
    op.drop_table('user')
    op.drop_table('configuracion_sistema')
