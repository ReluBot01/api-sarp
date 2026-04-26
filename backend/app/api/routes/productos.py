from typing import Any
from datetime import date, datetime, timedelta

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import or_
from sqlmodel import Session, func, select

from app.api.deps import CurrentSuperuser, CurrentUser, SessionDep
from app.core.constants import DEFAULT_DIAS_ALERTA_VENCIMIENTO
from app.core.cache import (
    get_cache, set_cache, invalidate_entity_cache,
    list_cache_key, item_cache_key, stats_cache_key,
    invalidate_stats_cache
)
from app.models import (
    Message,
    Producto,
    ProductoCreate,
    ProductoPublic,
    ProductoPublicExtended,
    ProductosPublic,
    ProductosPublicExtended,
    ProductoUpdate,
    Lote,
    ProductosStats,
    Proveedor,
    Fabricante,
    ConfiguracionSistema,
    CATEGORIAS_PRODUCTO,
    USOS_RECOMENDADOS,
    CONDICIONES_PRODUCTO,
    CategoriasPublic,
    CatalogosPublic,
)

router = APIRouter(prefix="/productos", tags=["productos"])


def _clave_categoria_normalizada(nombre: str) -> str:
    """Unifica mayúsculas/minúsculas y espacios para detectar duplicados gramaticales."""
    return " ".join(nombre.strip().split()).lower()


def _categorias_con_en_uso(session: Session) -> list[str]:
    """Catálogo oficial + categorías en BD, sin duplicar la misma categoría con distinto casing."""
    rows = session.exec(
        select(Producto.categoria).where(Producto.estado == True).distinct()
    ).all()
    # clave normalizada -> texto a mostrar (prioriza ortografía del catálogo oficial)
    por_clave: dict[str, str] = {}
    for c in CATEGORIAS_PRODUCTO:
        por_clave[_clave_categoria_normalizada(c)] = c
    for r in rows:
        if r is None:
            continue
        raw = str(r).strip()
        if not raw:
            continue
        clave = _clave_categoria_normalizada(raw)
        if clave not in por_clave:
            por_clave[clave] = raw
    return sorted(por_clave.values(), key=lambda x: x.lower())


def get_dias_alerta_vencimiento(session) -> int:
    """Obtiene los días de anticipación para alertas de vencimiento."""
    config = session.exec(select(ConfiguracionSistema)).first()
    return config.dias_alerta_vencimiento if config else DEFAULT_DIAS_ALERTA_VENCIMIENTO


def _producto_es_elegible_para_retiro(session, producto: Producto) -> tuple[bool, str]:
    """Vencido o dentro del rango de días de alerta (próximo a vencer)."""
    if not producto.estado:
        return False, "El producto está inactivo"
    if producto.retirado:
        return False, "El producto ya fue retirado"
    if not producto.fecha_vencimiento:
        return False, "El producto no tiene fecha de vencimiento"
    dias_alerta = get_dias_alerta_vencimiento(session)
    fecha_hoy = date.today()
    fecha_limite = fecha_hoy + timedelta(days=dias_alerta)
    fv = producto.fecha_vencimiento
    if fv < fecha_hoy:
        return True, ""
    if fv <= fecha_limite:
        return True, ""
    return (
        False,
        "Solo se puede retirar si está vencido o dentro del plazo configurado para alertas de vencimiento",
    )


@router.get("/categorias", response_model=CategoriasPublic)
def get_categorias(session: SessionDep, current_user: CurrentUser) -> CategoriasPublic:
    """
    Catálogo base + categorías que ya figuran en productos activos (histórico o variantes).
    """
    return CategoriasPublic(categorias=_categorias_con_en_uso(session))


@router.get("/catalogos", response_model=CatalogosPublic)
def get_catalogos(session: SessionDep, current_user: CurrentUser) -> CatalogosPublic:
    """
    Obtener todos los catálogos disponibles.
    """
    return CatalogosPublic(
        categorias=_categorias_con_en_uso(session),
        usos_recomendados=USOS_RECOMENDADOS,
        condiciones=CONDICIONES_PRODUCTO,
    )


@router.get("/retiro/pendientes", response_model=ProductosPublicExtended)
def read_pendientes_retiro(
    session: SessionDep,
    current_user: CurrentUser,
    limit: int = Query(default=24, ge=1, le=100),
) -> Any:
    """
    Productos vencidos o dentro del período de alerta de vencimiento, no retirados.
    Pensado para el dashboard y retiro rápido (orden por fecha de vencimiento ascendente).
    """
    dias_alerta = get_dias_alerta_vencimiento(session)
    fecha_hoy = date.today()
    fecha_limite = fecha_hoy + timedelta(days=dias_alerta)

    stmt = (
        select(
            Producto,
            Lote.numero_lote,
            Lote.fecha_llegada,
            Proveedor.nombre.label("proveedor_nombre"),
            Fabricante.nombre.label("fabricante_nombre"),
        )
        .outerjoin(Lote, Producto.id_lote == Lote.id_lote)
        .outerjoin(Proveedor, Lote.id_proveedor == Proveedor.id_proveedor)
        .outerjoin(Fabricante, Producto.id_fabricante == Fabricante.id_fabricante)
        .where(
            Producto.estado == True,
            Producto.retirado == False,
            Producto.fecha_vencimiento.isnot(None),
            or_(
                Producto.fecha_vencimiento < fecha_hoy,
                (Producto.fecha_vencimiento >= fecha_hoy)
                & (Producto.fecha_vencimiento <= fecha_limite),
            ),
        )
        .order_by(Producto.fecha_vencimiento.asc())
        .limit(limit)
    )

    results = session.exec(stmt).all()
    productos = [
        ProductoPublicExtended(
            **row[0].model_dump(),
            numero_lote=row[1],
            fecha_llegada=row[2],
            proveedor_nombre=row[3],
            fabricante_nombre=row[4],
        )
        for row in results
    ]

    count = len(productos)
    return ProductosPublicExtended(data=productos, count=count)


@router.get("/", response_model=ProductosPublicExtended)
def read_productos(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    q: str | None = None,
    id_lote: int | None = None,
    categoria: str | None = None,
    estado_calidad: str | None = None,
    apto_consumo: bool | None = None,
    bajo_stock: bool | None = None,
    por_vencer: bool | None = None,
) -> Any:
    """
    Obtener lista de productos con filtros opcionales.
    """
    # Generate cache key
    cache_key = list_cache_key(
        "productos",
        skip=skip,
        limit=limit,
        q=q,
        id_lote=id_lote,
        categoria=categoria,
        estado_calidad=estado_calidad,
        apto_consumo=str(apto_consumo) if apto_consumo is not None else None,
        bajo_stock=str(bajo_stock) if bajo_stock is not None else None,
        por_vencer=str(por_vencer) if por_vencer is not None else None,
    )
    
    cached_result = get_cache(cache_key)
    if cached_result is not None:
        return ProductosPublicExtended(**cached_result)
    
    # Build query with joins
    stmt = (
        select(
            Producto,
            Lote.numero_lote,
            Lote.fecha_llegada,
            Proveedor.nombre.label("proveedor_nombre"),
            Fabricante.nombre.label("fabricante_nombre")
        )
        .outerjoin(Lote, Producto.id_lote == Lote.id_lote)
        .outerjoin(Proveedor, Lote.id_proveedor == Proveedor.id_proveedor)
        .outerjoin(Fabricante, Producto.id_fabricante == Fabricante.id_fabricante)
        .where(Producto.estado == True)
    )
    
    # Apply filters
    if id_lote is not None:
        stmt = stmt.where(Producto.id_lote == id_lote)
    
    if categoria:
        cat_norm = categoria.strip()
        stmt = stmt.where(func.lower(Producto.categoria) == cat_norm.lower())
    
    if estado_calidad:
        stmt = stmt.where(Producto.estado_calidad == estado_calidad)
    
    if apto_consumo is not None:
        stmt = stmt.where(Producto.apto_consumo == apto_consumo)
    
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (Producto.nombre.ilike(like))
            | (Producto.codigo_interno.ilike(like))
            | (Producto.codigo_barras.ilike(like))
            | (Producto.marca.ilike(like))
            | (Producto.elaborado_por.ilike(like))
            | (Producto.lote_producto.ilike(like))
        )
    
    if bajo_stock:
        stmt = stmt.where(Producto.unidades <= Producto.stock_minimo)
    
    if por_vencer:
        dias_alerta = get_dias_alerta_vencimiento(session)
        fecha_limite = date.today() + timedelta(days=dias_alerta)
        stmt = stmt.where(
            Producto.retirado == False,
            Producto.fecha_vencimiento.isnot(None),
            Producto.fecha_vencimiento >= date.today(),
            Producto.fecha_vencimiento <= fecha_limite,
        )
    
    # Order by fecha_creacion descendente
    stmt = stmt.order_by(Producto.fecha_creacion.desc())
    
    # Count total
    count_stmt = select(func.count()).select_from(Producto).where(Producto.estado == True)
    if id_lote is not None:
        count_stmt = count_stmt.where(Producto.id_lote == id_lote)
    if categoria:
        cat_norm = categoria.strip()
        count_stmt = count_stmt.where(func.lower(Producto.categoria) == cat_norm.lower())
    if estado_calidad:
        count_stmt = count_stmt.where(Producto.estado_calidad == estado_calidad)
    if apto_consumo is not None:
        count_stmt = count_stmt.where(Producto.apto_consumo == apto_consumo)
    if q:
        count_stmt = count_stmt.where(
            (Producto.nombre.ilike(f"%{q}%"))
            | (Producto.codigo_interno.ilike(f"%{q}%"))
            | (Producto.codigo_barras.ilike(f"%{q}%"))
        )
    if bajo_stock:
        count_stmt = count_stmt.where(Producto.unidades <= Producto.stock_minimo)
    if por_vencer:
        dias_alerta = get_dias_alerta_vencimiento(session)
        fecha_limite = date.today() + timedelta(days=dias_alerta)
        count_stmt = count_stmt.where(
            Producto.retirado == False,
            Producto.fecha_vencimiento.isnot(None),
            Producto.fecha_vencimiento >= date.today(),
            Producto.fecha_vencimiento <= fecha_limite,
        )
    
    count = session.exec(count_stmt).one()
    
    # Execute query
    results = session.exec(stmt.offset(skip).limit(limit)).all()
    
    # Build response
    productos = []
    for row in results:
        producto = row[0]
        numero_lote = row[1]
        fecha_llegada = row[2]
        proveedor_nombre = row[3]
        fabricante_nombre = row[4]
        
        productos.append(ProductoPublicExtended(
            **producto.model_dump(),
            numero_lote=numero_lote,
            fecha_llegada=fecha_llegada,
            proveedor_nombre=proveedor_nombre,
            fabricante_nombre=fabricante_nombre,
        ))
    
    result = ProductosPublicExtended(data=productos, count=count)
    set_cache(cache_key, result.model_dump(), ttl=300)
    
    return result


@router.get("/stats", response_model=ProductosStats)
def read_productos_stats(session: SessionDep, current_user: CurrentUser) -> ProductosStats:
    """
    Obtener estadísticas de productos del inventario.
    """
    cache_key = stats_cache_key("productos:all")
    
    cached_result = get_cache(cache_key)
    if cached_result is not None:
        return ProductosStats(**cached_result)
    
    fecha_hoy = date.today()
    dias_alerta = get_dias_alerta_vencimiento(session)
    fecha_limite = fecha_hoy + timedelta(days=dias_alerta)
    
    # Total productos activos
    total_productos = session.exec(
        select(func.count()).select_from(Producto).where(Producto.estado == True)
    ).one()
    
    # Stock total (suma de unidades)
    stock_total = session.exec(
        select(func.coalesce(func.sum(Producto.unidades), 0))
        .where(Producto.estado == True)
    ).one()
    
    # Productos con bajo stock (unidades <= stock_minimo)
    productos_bajo_stock = session.exec(
        select(func.count()).select_from(Producto).where(
            Producto.estado == True,
            Producto.unidades <= Producto.stock_minimo,
            Producto.unidades > 0
        )
    ).one()
    
    # Productos sin stock
    productos_sin_stock = session.exec(
        select(func.count()).select_from(Producto).where(
            Producto.estado == True,
            Producto.unidades == 0
        )
    ).one()
    
    # Productos por vencer (dentro de los días configurados), sin retirados
    productos_por_vencer = session.exec(
        select(func.count()).select_from(Producto).where(
            Producto.estado == True,
            Producto.retirado == False,
            Producto.apto_consumo == True,
            Producto.unidades > 0,
            Producto.fecha_vencimiento.isnot(None),
            Producto.fecha_vencimiento >= fecha_hoy,
            Producto.fecha_vencimiento <= fecha_limite,
        )
    ).one()
    
    # Productos vencidos (activos y no retirados)
    productos_vencidos = session.exec(
        select(func.count()).select_from(Producto).where(
            Producto.estado == True,
            Producto.retirado == False,
            Producto.fecha_vencimiento.isnot(None),
            Producto.fecha_vencimiento < fecha_hoy,
        )
    ).one()
    
    # Lotes activos
    lotes_activos = session.exec(
        select(func.count()).select_from(Lote).where(Lote.estado == "Activo")
    ).one()
    
    result = ProductosStats(
        total_productos=int(total_productos),
        stock_total=int(stock_total),
        productos_bajo_stock=int(productos_bajo_stock),
        productos_sin_stock=int(productos_sin_stock),
        productos_por_vencer=int(productos_por_vencer),
        productos_vencidos=int(productos_vencidos),
        lotes_activos=int(lotes_activos),
    )
    
    set_cache(cache_key, result.model_dump(), ttl=60)
    
    return result


@router.get("/{id}", response_model=ProductoPublicExtended)
def read_producto(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Obtener producto por ID.
    """
    cache_key = item_cache_key("productos", id)
    
    cached_result = get_cache(cache_key)
    if cached_result is not None:
        return ProductoPublicExtended(**cached_result)
    
    # Query with joins
    stmt = (
        select(
            Producto,
            Lote.numero_lote,
            Lote.fecha_llegada,
            Proveedor.nombre.label("proveedor_nombre")
        )
        .outerjoin(Lote, Producto.id_lote == Lote.id_lote)
        .outerjoin(Proveedor, Lote.id_proveedor == Proveedor.id_proveedor)
        .where(Producto.id_producto == id)
    )
    
    result = session.exec(stmt).first()
    if not result:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    producto, numero_lote, fecha_llegada, proveedor_nombre = result
    
    response = ProductoPublicExtended(
        **producto.model_dump(),
        numero_lote=numero_lote,
        fecha_llegada=fecha_llegada,
        proveedor_nombre=proveedor_nombre,
    )
    
    set_cache(cache_key, response.model_dump(), ttl=300)
    
    return response


@router.post("/", response_model=ProductoPublic)
def create_producto(
    *,
    session: SessionDep,
    current_user: CurrentSuperuser,
    producto_in: ProductoCreate,
) -> Any:
    """
    Crear nuevo producto.
    """
    # Validar que el lote existe
    lote = session.get(Lote, producto_in.id_lote)
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    producto = Producto.model_validate(producto_in)
    
    # Si no es apto, asegurar motivo
    if not producto.apto_consumo and not producto.motivo_rechazo:
        producto.motivo_rechazo = "No especificado"
    
    session.add(producto)
    session.commit()
    session.refresh(producto)
    
    invalidate_entity_cache("productos")
    invalidate_stats_cache("productos")
    
    return producto


@router.put("/{id}", response_model=ProductoPublic)
def update_producto(
    *,
    session: SessionDep,
    current_user: CurrentSuperuser,
    id: int,
    producto_in: ProductoUpdate,
) -> Any:
    """
    Actualizar un producto.
    """
    producto = session.get(Producto, id)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    update_dict = producto_in.model_dump(exclude_unset=True)
    
    # Validar lote si se actualiza
    if "id_lote" in update_dict:
        lote = session.get(Lote, update_dict["id_lote"])
        if not lote:
            raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    producto.sqlmodel_update(update_dict)
    session.add(producto)
    session.commit()
    session.refresh(producto)
    
    invalidate_entity_cache("productos")
    invalidate_stats_cache("productos")
    
    return producto


@router.patch("/{id}/calidad")
def actualizar_calidad(
    *,
    session: SessionDep,
    current_user: CurrentSuperuser,
    id: int,
    estado_calidad: str,
    apto_consumo: bool,
    condicion: str | None = None,
    motivo_rechazo: str | None = None,
) -> Any:
    """
    Actualizar el estado de calidad de un producto.
    """
    producto = session.get(Producto, id)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    if estado_calidad not in ["Pendiente", "Aprobado", "Rechazado"]:
        raise HTTPException(
            status_code=400,
            detail="Estado de calidad inválido. Opciones: Pendiente, Aprobado, Rechazado"
        )
    
    if not apto_consumo and not motivo_rechazo:
        raise HTTPException(
            status_code=400,
            detail="Debe proporcionar un motivo de rechazo si el producto no es apto para consumo"
        )
    
    estado_anterior = producto.estado_calidad
    producto.estado_calidad = estado_calidad
    producto.apto_consumo = apto_consumo
    producto.motivo_rechazo = motivo_rechazo if not apto_consumo else None
    if condicion:
        producto.condicion = condicion
    
    session.add(producto)
    session.commit()
    session.refresh(producto)
    
    # Auditoría
    from app.models import Auditoria
    audit = Auditoria(
        entidad_afectada="producto",
        id_registro_afectado=str(id),
        accion="CONTROL_CALIDAD",
        detalle={
            "estado_anterior": estado_anterior,
            "estado_nuevo": estado_calidad,
            "apto_consumo": apto_consumo,
            "condicion": condicion,
            "motivo_rechazo": motivo_rechazo,
        },
        resultado="Éxito",
        id_usuario=current_user.id,
    )
    session.add(audit)
    session.commit()
    
    invalidate_entity_cache("productos")
    invalidate_stats_cache("productos")
    
    return {
        "message": "Estado de calidad actualizado",
        "estado_calidad": estado_calidad,
        "apto_consumo": apto_consumo,
        "condicion": condicion,
    }


@router.patch("/{id}/ajustar-stock")
def ajustar_stock(
    *,
    session: SessionDep,
    current_user: CurrentSuperuser,
    id: int,
    unidades: int,
    motivo: str | None = None,
) -> Any:
    """
    Ajustar el stock (unidades) de un producto.
    
    - unidades: Positivo para sumar, negativo para restar
    - motivo: Razón del ajuste (opcional)
    """
    producto = session.get(Producto, id)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    nueva_cantidad = producto.unidades + unidades
    
    if nueva_cantidad < 0:
        raise HTTPException(
            status_code=400,
            detail=f"No hay suficiente stock. Disponible: {producto.unidades}, Ajuste: {unidades}"
        )
    
    unidades_anterior = producto.unidades
    producto.unidades = nueva_cantidad
    
    session.add(producto)
    session.commit()
    session.refresh(producto)
    
    # Auditoría
    from app.models import Auditoria
    audit = Auditoria(
        entidad_afectada="producto",
        id_registro_afectado=str(id),
        accion="AJUSTE_STOCK",
        detalle={
            "unidades_anterior": unidades_anterior,
            "ajuste": unidades,
            "unidades_nueva": nueva_cantidad,
            "motivo": motivo,
        },
        resultado="Éxito",
        id_usuario=current_user.id,
    )
    session.add(audit)
    session.commit()
    
    invalidate_entity_cache("productos")
    invalidate_stats_cache("productos")
    
    return {
        "message": "Stock ajustado exitosamente",
        "unidades_anterior": unidades_anterior,
        "ajuste": unidades,
        "unidades_nueva": nueva_cantidad,
    }


@router.post("/{id}/retirar", response_model=ProductoPublicExtended)
def retirar_producto(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
) -> Any:
    """
    Marca el producto como retirado físicamente del circuito operativo.
    Solo si está vencido o dentro del umbral de alerta de vencimiento (config).
    No elimina el registro ni lo quita de la guía; deja de contar en alertas y métricas de vencimiento.
    """
    producto = session.get(Producto, id)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    ok, motivo = _producto_es_elegible_para_retiro(session, producto)
    if not ok:
        raise HTTPException(status_code=400, detail=motivo)

    producto.retirado = True
    producto.fecha_retiro = datetime.now()

    session.add(producto)

    from app.models import Auditoria

    audit = Auditoria(
        entidad_afectada="producto",
        id_registro_afectado=str(id),
        accion="RETIRO_FISICO",
        detalle={"fecha_retiro": producto.fecha_retiro.isoformat() if producto.fecha_retiro else None},
        resultado="Éxito",
        id_usuario=current_user.id,
    )
    session.add(audit)
    session.commit()
    session.refresh(producto)

    stmt = (
        select(
            Producto,
            Lote.numero_lote,
            Lote.fecha_llegada,
            Proveedor.nombre.label("proveedor_nombre"),
            Fabricante.nombre.label("fabricante_nombre"),
        )
        .outerjoin(Lote, Producto.id_lote == Lote.id_lote)
        .outerjoin(Proveedor, Lote.id_proveedor == Proveedor.id_proveedor)
        .outerjoin(Fabricante, Producto.id_fabricante == Fabricante.id_fabricante)
        .where(Producto.id_producto == id)
    )
    row = session.exec(stmt).first()
    if not row:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    pr, numero_lote, fecha_llegada, proveedor_nombre, fabricante_nombre = row
    invalidate_entity_cache("productos")
    invalidate_stats_cache("productos")

    return ProductoPublicExtended(
        **pr.model_dump(),
        numero_lote=numero_lote,
        fecha_llegada=fecha_llegada,
        proveedor_nombre=proveedor_nombre,
        fabricante_nombre=fabricante_nombre,
    )


@router.delete("/{id}")
def delete_producto(
    session: SessionDep, current_user: CurrentSuperuser, id: int
) -> Message:
    """
    Eliminar un producto (soft delete).
    """
    producto = session.get(Producto, id)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    producto.estado = False
    session.add(producto)
    session.commit()
    
    invalidate_entity_cache("productos")
    invalidate_stats_cache("productos")
    
    return Message(message="Producto eliminado exitosamente")
