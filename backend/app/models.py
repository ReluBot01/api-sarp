import uuid
from datetime import date, datetime
from typing import Any

from pydantic import EmailStr
from sqlalchemy import Column, JSON
from sqlmodel import Field, Relationship, SQLModel

from app.core.constants import DEFAULT_DIAS_ALERTA_VENCIMIENTO


# =============================================================================
# MODELO USER - SIMPLIFICADO PARA SISTEMA DE ALMACÉN ÚNICO
# =============================================================================

class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=40)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=40)
    full_name: str | None = Field(default=None, max_length=255)


class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore
    password: str | None = Field(default=None, min_length=8, max_length=40)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=40)
    new_password: str = Field(min_length=8, max_length=40)


class User(UserBase, table=True):
    __tablename__ = "user"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    fecha_creacion: datetime = Field(default_factory=datetime.now)
    
    # Relaciones
    items: list["Item"] = Relationship(
        back_populates="owner",
        cascade_delete=True,
        sa_relationship_kwargs={"lazy": "select"}
    )
    auditorias: list["Auditoria"] = Relationship(
        back_populates="usuario",
        sa_relationship_kwargs={"lazy": "select"}
    )
    lotes_recepcionados: list["Lote"] = Relationship(
        back_populates="usuario_recepcion",
        sa_relationship_kwargs={"lazy": "select"}
    )


class UserPublic(UserBase):
    id: uuid.UUID
    fecha_creacion: datetime | None = None


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# =============================================================================
# MODELO ITEM - MANTIENE UUID PARA COMPATIBILIDAD
# =============================================================================

class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


class ItemCreate(ItemBase):
    pass


class ItemUpdate(ItemBase):
    title: str | None = Field(default=None, min_length=1, max_length=255)  # type: ignore


class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# =============================================================================
# MODELOS DEL SISTEMA DE INVENTARIO DE ALMACÉN
# =============================================================================

# -----------------------------------------------------------------------------
# CATEGORÍAS DE PRODUCTOS
# -----------------------------------------------------------------------------
CATEGORIAS_PRODUCTO = [
    "Fruta, verduras y hortalizas",
    "Granos",
    "Cereales",
    "Proteínas",
    "Embutidos",
    "Enlatados",
    "Lácteos",
    "Grasas",
    "Salsas",
    "Azúcares",
    "Bebidas",
    "Confitería",
    "Productos de higiene personal",
    "Productos de limpieza",
    "Condimentos",
    "Hogar",
    "Otros",
]

# Opciones de uso recomendado
USOS_RECOMENDADOS = [
    "PC DIRECTO HUMANO (PCDH)",
    "PC INDIRECTO",
    "USO INDUSTRIAL",
    "USO AGRÍCOLA",
    "USO VETERINARIO",
    "OTRO"
]

# Condiciones del producto
CONDICIONES_PRODUCTO = [
    "OPTIMAS CONDICIONES",
    "DAÑADO",
    "VENCIDO",
    "NO APTO"
]


# -----------------------------------------------------------------------------
# CONFIGURACIÓN DEL SISTEMA
# -----------------------------------------------------------------------------


class ConfiguracionSistemaBase(SQLModel):
    nombre_almacen: str = Field(default="Almacén Principal", max_length=255)
    dias_alerta_vencimiento: int = Field(
        default=DEFAULT_DIAS_ALERTA_VENCIMIENTO,
        ge=1,
        description="Días de anticipación para alertas de vencimiento",
    )
    unidad_peso_defecto: str = Field(default="kg", description="Unidad de peso por defecto: ton, kg, g")


class ConfiguracionSistemaCreate(ConfiguracionSistemaBase):
    pass


class ConfiguracionSistemaUpdate(SQLModel):
    nombre_almacen: str | None = None
    dias_alerta_vencimiento: int | None = Field(default=None, ge=1)
    unidad_peso_defecto: str | None = None


class ConfiguracionSistema(ConfiguracionSistemaBase, table=True):
    __tablename__ = "configuracion_sistema"
    
    id: int | None = Field(default=None, primary_key=True, sa_column_kwargs={"autoincrement": True})
    fecha_actualizacion: datetime = Field(default_factory=datetime.now)


class ConfiguracionSistemaPublic(ConfiguracionSistemaBase):
    id: int
    fecha_actualizacion: datetime


# -----------------------------------------------------------------------------
# PROVEEDOR
# -----------------------------------------------------------------------------
class ProveedorBase(SQLModel):
    nombre: str = Field(max_length=255)
    rif: str = Field(unique=True, index=True, max_length=50, description="RIF del proveedor (formato: J-12345678-9)")
    telefono: str = Field(max_length=11, description="Teléfono (máximo 11 dígitos numéricos)")
    email: str = Field(max_length=255)
    direccion: str = Field(max_length=500)
    ciudad: str = Field(max_length=100)
    estado: bool = True


class ProveedorCreate(ProveedorBase):
    pass


class ProveedorUpdate(SQLModel):
    nombre: str | None = None
    rif: str | None = None
    telefono: str | None = None
    email: str | None = None
    direccion: str | None = None
    ciudad: str | None = None
    estado: bool | None = None


class Proveedor(ProveedorBase, table=True):
    __tablename__ = "proveedor"
    
    id_proveedor: int | None = Field(default=None, primary_key=True, sa_column_kwargs={"autoincrement": True})
    fecha_creacion: datetime = Field(default_factory=datetime.now)
    
    # Relaciones
    lotes: list["Lote"] = Relationship(back_populates="proveedor")


class ProveedorPublic(ProveedorBase):
    id_proveedor: int
    fecha_creacion: datetime | None = None
    # Campos calculados
    total_lotes: int | None = None
    ultima_entrega: datetime | None = None


class ProveedoresPublic(SQLModel):
    data: list[ProveedorPublic]
    count: int


# -----------------------------------------------------------------------------
# FABRICANTE - Empresas que elaboran los productos
# -----------------------------------------------------------------------------
class FabricanteBase(SQLModel):
    nombre: str = Field(max_length=255, description="Nombre del fabricante")
    rif: str = Field(max_length=50, description="RIF del fabricante (formato: J-12345678-9)")
    contacto: str | None = Field(default=None, max_length=100, description="Persona de contacto")
    telefono: str | None = Field(default=None, max_length=11, description="Teléfono de contacto (máximo 11 dígitos numéricos)")
    email: str | None = Field(default=None, max_length=255, description="Correo electrónico")
    direccion: str | None = Field(default=None, max_length=500, description="Dirección")
    estado: bool = Field(default=True, description="Activo/Inactivo")


class FabricanteCreate(FabricanteBase):
    pass


class FabricanteUpdate(SQLModel):
    nombre: str | None = None
    rif: str | None = None
    contacto: str | None = None
    telefono: str | None = None
    email: str | None = None
    direccion: str | None = None
    estado: bool | None = None


class Fabricante(FabricanteBase, table=True):
    __tablename__ = "fabricante"
    
    id_fabricante: int | None = Field(default=None, primary_key=True, sa_column_kwargs={"autoincrement": True})
    fecha_creacion: datetime = Field(default_factory=datetime.now)
    
    # Relaciones
    productos: list["Producto"] = Relationship(back_populates="fabricante")


class FabricantePublic(FabricanteBase):
    id_fabricante: int
    fecha_creacion: datetime | None = None


class FabricantesPublic(SQLModel):
    data: list[FabricantePublic]
    count: int


# -----------------------------------------------------------------------------
# LOTE - Solo registro de llegada de carga
# -----------------------------------------------------------------------------
class LoteBase(SQLModel):
    numero_lote: str = Field(max_length=100)
    observaciones: str | None = Field(default=None, max_length=1000)


class LoteCreate(SQLModel):
    """Modelo para crear un lote/recepción de carga."""
    numero_lote: str | None = Field(default=None, max_length=100, description="Opcional, se genera automáticamente si es None")
    id_proveedor: int | None = Field(
        default=None,
        description="Compatibilidad: un solo proveedor; usar id_proveedores para varios",
    )
    id_proveedores: list[int] = Field(
        default_factory=list,
        description="Lista ordenada de proveedores de la guía (el primero es el principal)",
    )

    # Peso de la carga
    peso_total_recibido: float = Field(default=0, ge=0, description="Peso total de la carga")
    unidad_peso: str = Field(default="kg", description="ton, kg, g")
    
    observaciones: str | None = Field(default=None, max_length=1000)


class LoteUpdate(SQLModel):
    numero_lote: str | None = None
    id_proveedor: int | None = None
    estado: str | None = None
    peso_total_recibido: float | None = None
    unidad_peso: str | None = None
    observaciones: str | None = None


class RecepcionRequest(SQLModel):
    """Modelo para recepción de lote con productos."""
    lote: LoteCreate
    productos: list["ProductoLoteCreate"] = []


class Lote(LoteBase, table=True):
    __tablename__ = "lote"
    
    id_lote: int | None = Field(default=None, primary_key=True, sa_column_kwargs={"autoincrement": True})
    id_proveedor: int = Field(foreign_key="proveedor.id_proveedor")
    id_usuario_recepcion: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    
    # Fecha de llegada
    fecha_llegada: datetime = Field(default_factory=datetime.now, description="Fecha de recepción del camión/carga")
    fecha_registro: datetime = Field(default_factory=datetime.now)
    
    # Estado del lote
    estado: str = Field(default="Activo", description="Activo, Cerrado")
    
    # Una sola edición permitida del lote/productos (después queda bloqueado)
    edicion_realizada: bool = Field(default=False, description="True si ya se aplicó la edición única")
    
    # Peso de la carga
    peso_total_recibido: float = Field(default=0, ge=0)
    unidad_peso: str = Field(default="kg", description="ton, kg, g")
    
    # Relaciones
    proveedor: Proveedor | None = Relationship(back_populates="lotes")
    usuario_recepcion: User | None = Relationship(back_populates="lotes_recepcionados")
    productos: list["Producto"] = Relationship(back_populates="lote")


class LoteProveedorLink(SQLModel, table=True):
    """Varios proveedores asociados a una misma guía de recepción."""

    __tablename__ = "lote_proveedor"

    id_lote: int = Field(foreign_key="lote.id_lote", primary_key=True)
    id_proveedor: int = Field(foreign_key="proveedor.id_proveedor", primary_key=True)
    orden: int = Field(default=0, description="Orden de captura / visualización")


class ProveedorEnLotePublic(SQLModel):
    id_proveedor: int
    nombre: str | None = None
    orden: int = 0


class LotePublic(SQLModel):
    id_lote: int
    numero_lote: str
    fecha_llegada: datetime
    fecha_registro: datetime
    estado: str
    peso_total_recibido: float
    unidad_peso: str
    observaciones: str | None
    id_proveedor: int
    id_usuario_recepcion: uuid.UUID | None
    edicion_realizada: bool = False
    # Campos calculados/relacionados
    proveedor_nombre: str | None = None
    proveedores: list[ProveedorEnLotePublic] = Field(default_factory=list)
    usuario_recepcion_nombre: str | None = None
    total_productos: int | None = None
    stock_total: int | None = None
    # Estado de calidad calculado (según productos del lote)
    estado_calidad: str | None = None


class LoteEdicionRegistroPublic(SQLModel):
    """Registro de la única edición permitida de un lote (desde auditoría)."""
    id_auditoria: int
    id_usuario: uuid.UUID
    usuario_nombre: str | None = None
    fecha_modificacion: datetime
    resumen: str
    detalle: dict[str, Any] = Field(default_factory=dict)


class LotePublicExtended(LotePublic):
    """Lote con lista de productos incluida."""
    productos: list["ProductoPublic"] = []
    registro_edicion: LoteEdicionRegistroPublic | None = None


class LotesPublic(SQLModel):
    data: list[LotePublic]
    count: int


class LotesStats(SQLModel):
    total_lotes: int
    activos: int
    cerrados: int
    peso_total_almacen: float
    unidad_peso: str


class LoteReciente(SQLModel):
    """Modelo simple para lotes recientes."""
    id_lote: int
    numero_lote: str
    fecha_llegada: datetime
    proveedor_nombre: str | None = None
    total_productos: int = 0
    estado_calidad: str | None = None


# -----------------------------------------------------------------------------
# PRODUCTO - Con todos los campos de la ficha de recepción
# -----------------------------------------------------------------------------
class ProductoBase(SQLModel):
    # Información básica
    nombre: str = Field(max_length=255, description="Nombre del producto")
    categoria: str = Field(default="Otros", max_length=100, description="Categoría del producto")
    
    # Fabricante (ahora con relación)
    id_fabricante: int | None = Field(default=None, description="ID del fabricante")
    elaborado_por: str | None = Field(default=None, max_length=255, description="Nombre del fabricante (para compatibilidad)")
    
    # Marca y presentación
    marca: str | None = Field(default=None, max_length=100)
    presentacion: str | None = Field(default=None, max_length=150, description="Ej: BULTOS 900 GR X 20 UND")
    
    # Lote del producto (diferente del lote de recepción)
    lote_producto: str | None = Field(default=None, max_length=100, description="Número de lote del producto (del fabricante)")
    
    # Fechas
    fecha_elaboracion: date | None = Field(default=None, description="Fecha de elaboración/fabricación")
    fecha_vencimiento: date | None = Field(default=None, description="Fecha de vencimiento del producto")
    
    # Uso y condición
    uso_recomendado: str = Field(default="PC DIRECTO HUMANO (PCDH)", max_length=100)
    condicion: str = Field(default="OPTIMAS CONDICIONES", max_length=100, description="Condición/Estado del producto")
    
    # Cantidades (las 3 unidades de medida)
    cantidad_tm: float = Field(
        default=0,
        ge=0,
        description="Toneladas métricas por unidad física (coherente con kg/unidad)",
    )
    cantidad_kg: float = Field(
        default=0,
        ge=0,
        description="Kilogramos por unidad física; peso de línea ≈ cantidad_kg × unidades",
    )
    unidades: int = Field(default=0, ge=0, description="Cantidad en unidades físicas")
    
    # Control de calidad
    estado_calidad: str = Field(default="Aprobado", description="Pendiente, Aprobado, Rechazado")
    apto_consumo: bool = Field(default=True, description="True si pasa control de calidad")
    motivo_rechazo: str | None = Field(default=None, max_length=500, description="Si no es apto, motivo de rechazo")
    
    # Stock mínimo para alertas
    stock_minimo: int = Field(default=0, ge=0, description="Umbral de alerta de bajo stock")
    
    # Campos opcionales adicionales
    descripcion: str | None = Field(default=None, max_length=500)
    codigo_interno: str | None = Field(default=None, max_length=50, index=True)
    codigo_barras: str | None = Field(default=None, max_length=50, index=True)
    
    estado: bool = True
    # Retiro físico: no participa en alertas/métricas de vencimiento; sigue en la guía.
    retirado: bool = Field(default=False, description="Retirado del circuito operativo de alertas")
    fecha_retiro: datetime | None = Field(default=None, description="Momento del retiro")


class ProductoLoteCreate(SQLModel):
    """Modelo para crear productos dentro de un lote/recepción."""
    # Información básica
    nombre: str = Field(max_length=255)
    categoria: str = Field(default="Otros", max_length=100)
    
    # Fabricante (usar id_fabricante o elaborado_por)
    id_fabricante: int | None = None
    elaborado_por: str | None = None
    
    # Marca y presentación
    marca: str | None = None
    presentacion: str | None = None
    
    # Lote del producto
    lote_producto: str | None = Field(default=None, description="S/L si no tiene")
    
    # Fechas (pueden ser nulas si no aplica)
    fecha_elaboracion: date | None = Field(default=None, description="S/F si no tiene")
    fecha_vencimiento: date | None = Field(default=None, description="S/F si no tiene")
    
    # Uso y condición
    uso_recomendado: str = Field(default="PC DIRECTO HUMANO (PCDH)")
    condicion: str = Field(default="OPTIMAS CONDICIONES")
    
    # Cantidades
    cantidad_tm: float = Field(default=0, ge=0)
    cantidad_kg: float = Field(default=0, ge=0)
    unidades: int = Field(default=0, ge=0)
    
    # Control de calidad
    estado_calidad: str = Field(default="Aprobado")
    apto_consumo: bool = Field(default=True)
    motivo_rechazo: str | None = None
    
    # Stock mínimo
    stock_minimo: int = Field(default=0, ge=0)
    
    # Campos opcionales
    descripcion: str | None = None
    codigo_interno: str | None = None
    codigo_barras: str | None = None


class ProductoCreate(ProductoBase):
    id_lote: int


class ProductoUpdate(SQLModel):
    nombre: str | None = None
    categoria: str | None = None
    id_fabricante: int | None = None
    elaborado_por: str | None = None
    marca: str | None = None
    presentacion: str | None = None
    lote_producto: str | None = None
    fecha_elaboracion: date | None = None
    fecha_vencimiento: date | None = None
    uso_recomendado: str | None = None
    condicion: str | None = None
    cantidad_tm: float | None = None
    cantidad_kg: float | None = None
    unidades: int | None = None
    estado_calidad: str | None = None
    apto_consumo: bool | None = None
    motivo_rechazo: str | None = None
    stock_minimo: int | None = None
    descripcion: str | None = None
    codigo_interno: str | None = None
    codigo_barras: str | None = None
    id_lote: int | None = None
    estado: bool | None = None


class ProductoEdicionUnicaItem(ProductoUpdate):
    """Producto existente a actualizar dentro de la edición única del lote."""
    id_producto: int


class LoteEdicionUnicaRequest(SQLModel):
    """Cambios del lote y de todos sus productos en una sola operación."""
    numero_lote: str = Field(max_length=100)
    id_proveedor: int | None = Field(
        default=None,
        description="Compatibilidad: un solo proveedor; usar id_proveedores para varios",
    )
    id_proveedores: list[int] = Field(
        default_factory=list,
        description="Lista ordenada de proveedores de la guía (el primero es el principal)",
    )
    productos: list[ProductoEdicionUnicaItem] = Field(
        default_factory=list,
        description="Un ítem por cada producto actual del lote (lista vacía si el lote no tiene productos)",
    )


class Producto(ProductoBase, table=True):
    __tablename__ = "producto"
    
    id_producto: int | None = Field(default=None, primary_key=True, sa_column_kwargs={"autoincrement": True})
    id_lote: int = Field(foreign_key="lote.id_lote")
    id_fabricante: int | None = Field(default=None, foreign_key="fabricante.id_fabricante")
    fecha_creacion: datetime = Field(default_factory=datetime.now)
    
    # Relaciones
    lote: Lote | None = Relationship(back_populates="productos")
    fabricante: Fabricante | None = Relationship(back_populates="productos")


class ProductoPublic(ProductoBase):
    id_producto: int
    id_lote: int
    fecha_creacion: datetime
    fabricante_nombre: str | None = None


class ProductoPublicExtended(ProductoPublic):
    """Producto con información del lote."""
    numero_lote: str | None = None
    fecha_llegada: datetime | None = None
    proveedor_nombre: str | None = None
    fabricante_nombre: str | None = None


class ProductosPublic(SQLModel):
    data: list[ProductoPublic]
    count: int


class ProductosPublicExtended(SQLModel):
    data: list[ProductoPublicExtended]
    count: int


class ProductosStats(SQLModel):
    """Estadísticas del inventario de productos."""
    total_productos: int
    stock_total: int
    productos_bajo_stock: int
    productos_sin_stock: int
    productos_por_vencer: int
    productos_vencidos: int
    lotes_activos: int


# -----------------------------------------------------------------------------
# AUDITORIA - Registro de acciones
# -----------------------------------------------------------------------------
class AuditoriaBase(SQLModel):
    entidad_afectada: str = Field(max_length=100)
    id_registro_afectado: str = Field(max_length=100, description="ID del registro afectado")
    accion: str = Field(max_length=50, description="CREATE, UPDATE, DELETE, RECEPCION, etc.")
    detalle: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    resultado: str = Field(default="Éxito", max_length=50, description="Éxito, Error")


class AuditoriaCreate(AuditoriaBase):
    id_usuario: str  # UUID de User como string


class Auditoria(AuditoriaBase, table=True):
    __tablename__ = "auditoria"
    
    id_auditoria: int | None = Field(default=None, primary_key=True, sa_column_kwargs={"autoincrement": True})
    id_usuario: uuid.UUID = Field(foreign_key="user.id")
    fecha_accion: datetime = Field(default_factory=datetime.now)
    
    # Relaciones
    usuario: User | None = Relationship(back_populates="auditorias")


class AuditoriaPublic(AuditoriaBase):
    id_auditoria: int
    id_usuario: uuid.UUID
    fecha_accion: datetime
    usuario_nombre: str | None = None


class AuditoriasPublic(SQLModel):
    data: list[AuditoriaPublic]
    count: int


# =============================================================================
# MODELOS GENÉRICOS PARA API
# =============================================================================

class Message(SQLModel):
    message: str


class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=40)


# -----------------------------------------------------------------------------
# ALERTAS DE VENCIMIENTO
# -----------------------------------------------------------------------------
class AlertaVencimiento(SQLModel):
    """Modelo para alertas de productos próximos a vencer."""
    id_producto: int
    nombre: str
    categoria: str
    fecha_vencimiento: date | None
    dias_restantes: int
    unidades: int
    numero_lote: str | None = None
    proveedor_nombre: str | None = None
    prioridad: str = Field(
        description="alta (<=7 días), media (<=15 días), baja (>15 días dentro del umbral de alerta)"
    )


class AlertasVencimientoPublic(SQLModel):
    data: list[AlertaVencimiento]
    count: int
    dias_configurados: int


# -----------------------------------------------------------------------------
# CATÁLOGOS DISPONIBLES (para API)
# -----------------------------------------------------------------------------
class CategoriasPublic(SQLModel):
    categorias: list[str]


class CatalogosPublic(SQLModel):
    """Todos los catálogos disponibles para el frontend."""
    categorias: list[str]
    usos_recomendados: list[str]
    condiciones: list[str]
