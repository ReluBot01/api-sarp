import uuid
from typing import Any
from datetime import date, timedelta

from sqlmodel import Session, select, func

from app.core.constants import DEFAULT_DIAS_ALERTA_VENCIMIENTO
from app.core.security import get_password_hash, verify_password
from app.models import (
    Auditoria,
    AuditoriaCreate,
    ConfiguracionSistema,
    ConfiguracionSistemaUpdate,
    Item,
    ItemCreate,
    Lote,
    LoteCreate,
    LoteUpdate,
    Producto,
    ProductoCreate,
    ProductoUpdate,
    Proveedor,
    ProveedorCreate,
    ProveedorUpdate,
    User,
    UserCreate,
    UserUpdate,
)


# =============================================================================
# USER
# =============================================================================

def create_user(*, session: Session, user_create: UserCreate) -> User:
    """Crear un nuevo usuario."""
    user_data = user_create.model_dump(exclude_unset=True, exclude={"password"})
    user_data["hashed_password"] = get_password_hash(user_create.password)
    db_obj = User(**user_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_user(*, session: Session, db_user: User, user_in: UserUpdate) -> Any:
    """Actualizar un usuario existente."""
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data:
        password = user_data["password"]
        hashed_password = get_password_hash(password)
        extra_data["hashed_password"] = hashed_password
    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_email(*, session: Session, email: str) -> User | None:
    """Obtener un usuario por email."""
    statement = select(User).where(User.email == email)
    return session.exec(statement).first()


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    """Autenticar un usuario por email y contraseña."""
    db_user = get_user_by_email(session=session, email=email)
    if not db_user:
        return None
    if not verify_password(password, db_user.hashed_password):
        return None
    return db_user


def create_item(*, session: Session, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
    """Crear un nuevo item."""
    db_item = Item.model_validate(item_in, update={"owner_id": owner_id})
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item


# =============================================================================
# CONFIGURACIÓN DEL SISTEMA
# =============================================================================

def get_configuracion(*, session: Session) -> ConfiguracionSistema:
    """Obtener la configuración del sistema o crear una por defecto."""
    config = session.exec(select(ConfiguracionSistema)).first()
    if not config:
        config = ConfiguracionSistema(
            nombre_almacen="Almacén Principal",
            dias_alerta_vencimiento=DEFAULT_DIAS_ALERTA_VENCIMIENTO,
            unidad_peso_defecto="kg"
        )
        session.add(config)
        session.commit()
        session.refresh(config)
    return config


def update_configuracion(
    *, session: Session, config_in: ConfiguracionSistemaUpdate
) -> ConfiguracionSistema:
    """Actualizar la configuración del sistema."""
    config = get_configuracion(session=session)
    config_data = config_in.model_dump(exclude_unset=True)
    config.sqlmodel_update(config_data)
    session.add(config)
    session.commit()
    session.refresh(config)
    return config


# =============================================================================
# PROVEEDOR
# =============================================================================

def create_proveedor(*, session: Session, proveedor_in: ProveedorCreate) -> Proveedor:
    """Crear un nuevo proveedor."""
    db_obj = Proveedor.model_validate(proveedor_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_proveedor(*, session: Session, proveedor_id: int) -> Proveedor | None:
    """Obtener un proveedor por ID."""
    return session.get(Proveedor, proveedor_id)


def get_proveedor_by_nit(*, session: Session, nit: str) -> Proveedor | None:
    """Obtener un proveedor por NIT."""
    statement = select(Proveedor).where(Proveedor.nit == nit)
    return session.exec(statement).first()


def get_proveedores(
    *, session: Session, skip: int = 0, limit: int = 100, activos_only: bool = False
) -> list[Proveedor]:
    """Obtener lista de proveedores con paginación."""
    statement = select(Proveedor)
    if activos_only:
        statement = statement.where(Proveedor.estado == True)
    statement = statement.offset(skip).limit(limit)
    return list(session.exec(statement).all())


def update_proveedor(
    *, session: Session, db_proveedor: Proveedor, proveedor_in: ProveedorUpdate
) -> Proveedor:
    """Actualizar un proveedor existente."""
    proveedor_data = proveedor_in.model_dump(exclude_unset=True)
    db_proveedor.sqlmodel_update(proveedor_data)
    session.add(db_proveedor)
    session.commit()
    session.refresh(db_proveedor)
    return db_proveedor


def delete_proveedor(*, session: Session, proveedor_id: int) -> bool:
    """Soft delete: marcar proveedor como inactivo."""
    proveedor = get_proveedor(session=session, proveedor_id=proveedor_id)
    if proveedor:
        proveedor.estado = False
        session.add(proveedor)
        session.commit()
        return True
    return False


# =============================================================================
# LOTE
# =============================================================================

def create_lote(*, session: Session, lote_in: LoteCreate) -> Lote:
    """Crear un nuevo lote."""
    db_obj = Lote.model_validate(lote_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_lote(*, session: Session, lote_id: int) -> Lote | None:
    """Obtener un lote por ID."""
    return session.get(Lote, lote_id)


def get_lote_by_numero(*, session: Session, numero_lote: str) -> Lote | None:
    """Obtener un lote por número."""
    statement = select(Lote).where(Lote.numero_lote == numero_lote)
    return session.exec(statement).first()


def get_lotes(*, session: Session, skip: int = 0, limit: int = 100) -> list[Lote]:
    """Obtener lista de lotes con paginación."""
    statement = select(Lote).order_by(Lote.fecha_llegada.desc()).offset(skip).limit(limit)
    return list(session.exec(statement).all())


def get_lotes_by_proveedor(
    *, session: Session, proveedor_id: int, skip: int = 0, limit: int = 100
) -> list[Lote]:
    """Obtener lotes de un proveedor específico."""
    statement = (
        select(Lote)
        .where(Lote.id_proveedor == proveedor_id)
        .order_by(Lote.fecha_llegada.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(session.exec(statement).all())


def get_lotes_proximos_vencer(
    *, session: Session, dias: int | None = None, skip: int = 0, limit: int = 100
) -> list[Lote]:
    """Obtener lotes próximos a vencer."""
    if dias is None:
        config = get_configuracion(session=session)
        dias = config.dias_alerta_vencimiento
    
    fecha_hoy = date.today()
    fecha_limite = fecha_hoy + timedelta(days=dias)
    
    statement = (
        select(Lote)
        .where(
            Lote.estado == "Activo",
            Lote.apto_consumo == True,
            Lote.fecha_vencimiento >= fecha_hoy,
            Lote.fecha_vencimiento <= fecha_limite
        )
        .order_by(Lote.fecha_vencimiento.asc())
        .offset(skip)
        .limit(limit)
    )
    return list(session.exec(statement).all())


def update_lote(*, session: Session, db_lote: Lote, lote_in: LoteUpdate) -> Lote:
    """Actualizar un lote existente."""
    lote_data = lote_in.model_dump(exclude_unset=True)
    db_lote.sqlmodel_update(lote_data)
    session.add(db_lote)
    session.commit()
    session.refresh(db_lote)
    return db_lote


# =============================================================================
# PRODUCTO
# =============================================================================

def create_producto(*, session: Session, producto_in: ProductoCreate) -> Producto:
    """Crear un nuevo producto."""
    db_obj = Producto.model_validate(producto_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_producto(*, session: Session, producto_id: int) -> Producto | None:
    """Obtener un producto por ID."""
    return session.get(Producto, producto_id)


def get_producto_by_codigo_interno(
    *, session: Session, codigo_interno: str
) -> Producto | None:
    """Obtener un producto por código interno."""
    statement = select(Producto).where(Producto.codigo_interno == codigo_interno)
    return session.exec(statement).first()


def get_producto_by_codigo_barras(
    *, session: Session, codigo_barras: str
) -> Producto | None:
    """Obtener un producto por código de barras."""
    statement = select(Producto).where(Producto.codigo_barras == codigo_barras)
    return session.exec(statement).first()


def get_productos(
    *, session: Session, skip: int = 0, limit: int = 100, activos_only: bool = True
) -> list[Producto]:
    """Obtener lista de productos con paginación."""
    statement = select(Producto)
    if activos_only:
        statement = statement.where(Producto.estado == True)
    statement = statement.offset(skip).limit(limit)
    return list(session.exec(statement).all())


def get_productos_by_lote(
    *, session: Session, lote_id: int, skip: int = 0, limit: int = 100
) -> list[Producto]:
    """Obtener productos de un lote específico."""
    statement = (
        select(Producto)
        .where(Producto.id_lote == lote_id)
        .offset(skip)
        .limit(limit)
    )
    return list(session.exec(statement).all())


def get_productos_bajo_stock(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[Producto]:
    """Obtener productos con stock por debajo del mínimo."""
    statement = (
        select(Producto)
        .where(
            Producto.estado == True,
            Producto.unidades <= Producto.stock_minimo
        )
        .offset(skip)
        .limit(limit)
    )
    return list(session.exec(statement).all())


def update_producto(
    *, session: Session, db_producto: Producto, producto_in: ProductoUpdate
) -> Producto:
    """Actualizar un producto existente."""
    producto_data = producto_in.model_dump(exclude_unset=True)
    db_producto.sqlmodel_update(producto_data)
    session.add(db_producto)
    session.commit()
    session.refresh(db_producto)
    return db_producto


def delete_producto(*, session: Session, producto_id: int) -> bool:
    """Soft delete: marcar producto como inactivo."""
    producto = get_producto(session=session, producto_id=producto_id)
    if producto:
        producto.estado = False
        session.add(producto)
        session.commit()
        return True
    return False


def ajustar_stock_producto(
    *, session: Session, producto_id: int, cantidad: int
) -> Producto | None:
    """
    Ajustar el stock disponible de un producto.
    cantidad positiva = suma, cantidad negativa = resta
    """
    producto = get_producto(session=session, producto_id=producto_id)
    if producto:
        nueva_cantidad = producto.unidades + cantidad
        if nueva_cantidad < 0:
            return None  # No se puede tener stock negativo
        producto.unidades = nueva_cantidad
        session.add(producto)
        session.commit()
        session.refresh(producto)
    return producto


# =============================================================================
# AUDITORIA
# =============================================================================

def create_auditoria(*, session: Session, auditoria_in: AuditoriaCreate) -> Auditoria:
    """Crear un nuevo registro de auditoría."""
    db_obj = Auditoria.model_validate(auditoria_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_auditoria(*, session: Session, auditoria_id: int) -> Auditoria | None:
    """Obtener un registro de auditoría por ID."""
    return session.get(Auditoria, auditoria_id)


def get_auditorias(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[Auditoria]:
    """Obtener lista de auditorías con paginación."""
    statement = (
        select(Auditoria)
        .order_by(Auditoria.fecha_accion.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(session.exec(statement).all())


def get_auditorias_by_usuario(
    *, session: Session, usuario_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[Auditoria]:
    """Obtener auditorías de un usuario específico."""
    statement = (
        select(Auditoria)
        .where(Auditoria.id_usuario == usuario_id)
        .order_by(Auditoria.fecha_accion.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(session.exec(statement).all())


def get_auditorias_by_entidad(
    *, session: Session, entidad: str, skip: int = 0, limit: int = 100
) -> list[Auditoria]:
    """Obtener auditorías de una entidad específica."""
    statement = (
        select(Auditoria)
        .where(Auditoria.entidad_afectada == entidad)
        .order_by(Auditoria.fecha_accion.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(session.exec(statement).all())
