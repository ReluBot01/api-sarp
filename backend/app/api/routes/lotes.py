from typing import Any
from datetime import date, datetime, timedelta

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import delete, or_
from sqlmodel import Session, func, select

from app.api.deps import CurrentSuperuser, CurrentUser, SessionDep
from app.core.constants import DEFAULT_DIAS_ALERTA_VENCIMIENTO
from app.core.cache import (
    get_cache,
    set_cache,
    invalidate_entity_cache,
    invalidate_item_cache,
    list_cache_key,
    item_cache_key,
    stats_cache_key,
    invalidate_stats_cache,
)
from app.models import (
    Lote,
    LoteCreate,
    LotePublic,
    LotePublicExtended,
    LotesPublic,
    LotesStats,
    LoteUpdate,
    LoteReciente,
    LoteEdicionUnicaRequest,
    LoteEdicionRegistroPublic,
    LoteProveedorLink,
    ProveedorEnLotePublic,
    ProductoUpdate,
    Producto,
    ProductoLoteCreate,
    ProductoPublic,
    Auditoria,
    Proveedor,
    Fabricante,
    ConfiguracionSistema,
    AlertaVencimiento,
    AlertasVencimientoPublic,
    User,
    CATEGORIAS_PRODUCTO,
    USOS_RECOMENDADOS,
    CONDICIONES_PRODUCTO,
    CategoriasPublic,
    CatalogosPublic,
    RecepcionRequest,
)
from app.peso_producto import peso_total_lote_kg_desde_productos
from app.utils import sanitize_producto_data, sanitize_string_upper


router = APIRouter(prefix="/lotes", tags=["lotes"])


# ============================================================================
# FUNCIONES AUXILIARES
# ============================================================================

def generar_numero_lote_unico(session: SessionDep, id_proveedor: int) -> str:
    """Genera un número de lote único basado en timestamp y proveedor."""
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    base_numero = f"LOT-P{id_proveedor}-{timestamp}"
    
    # Verificar si ya existe
    contador = 1
    numero_lote = base_numero
    while True:
        exists = session.exec(
            select(Lote).where(Lote.numero_lote == numero_lote)
        ).first()
        
        if not exists:
            break
        
        numero_lote = f"{base_numero}-{contador:03d}"
        contador += 1
        if contador > 999:
            from time import time
            numero_lote = f"LOT-P{id_proveedor}-{int(time() * 1000000)}"
            break
    
    return numero_lote


def _proveedores_por_lotes(
    session: Session, lote_ids: list[int]
) -> dict[int, list[ProveedorEnLotePublic]]:
    """Proveedores vinculados por guía, ordenados."""
    if not lote_ids:
        return {}
    stmt = (
        select(
            LoteProveedorLink.id_lote,
            LoteProveedorLink.id_proveedor,
            LoteProveedorLink.orden,
            Proveedor.nombre,
        )
        .join(Proveedor, Proveedor.id_proveedor == LoteProveedorLink.id_proveedor)
        .where(LoteProveedorLink.id_lote.in_(lote_ids))
        .order_by(
            LoteProveedorLink.id_lote,
            LoteProveedorLink.orden,
            LoteProveedorLink.id_proveedor,
        )
    )
    out: dict[int, list[ProveedorEnLotePublic]] = {}
    for row in session.exec(stmt).all():
        lid, pid, orden, nombre = row
        out.setdefault(lid, []).append(
            ProveedorEnLotePublic(id_proveedor=pid, nombre=nombre, orden=orden)
        )
    return out


def _resolver_ids_proveedores_recepcion(lote_in: LoteCreate) -> list[int]:
    raw = list(lote_in.id_proveedores) if lote_in.id_proveedores else []
    if not raw and lote_in.id_proveedor is not None:
        raw = [lote_in.id_proveedor]
    seen: set[int] = set()
    out: list[int] = []
    for x in raw:
        if x and x not in seen:
            seen.add(x)
            out.append(int(x))
    return out


def _resolver_ids_edicion(body: LoteEdicionUnicaRequest) -> list[int]:
    raw = list(body.id_proveedores) if body.id_proveedores else []
    if not raw and body.id_proveedor is not None:
        raw = [body.id_proveedor]
    seen: set[int] = set()
    out: list[int] = []
    for x in raw:
        if x and x not in seen:
            seen.add(x)
            out.append(int(x))
    return out


def get_dias_alerta_vencimiento(session: SessionDep) -> int:
    """Obtiene los días de anticipación para alertas de vencimiento."""
    config = session.exec(select(ConfiguracionSistema)).first()
    return config.dias_alerta_vencimiento if config else DEFAULT_DIAS_ALERTA_VENCIMIENTO


def calcular_estado_calidad_lote(productos: list[Producto]) -> str:
    """
    Calcula el estado de calidad del lote según sus productos.
    
    Reglas:
    - Si no hay productos: Pendiente
    - Si existe algún producto rechazado (estado_calidad == 'Rechazado' o apto_consumo == False): Rechazado
    - Si todos los productos están aprobados y aptos: Aprobado
    - En cualquier otro caso: Pendiente
    """
    if not productos:
        return "Pendiente"
    
    hay_rechazo = any(
        (p.estado_calidad or "").strip().lower() == "rechazado" or (p.apto_consumo is False)
        for p in productos
    )
    if hay_rechazo:
        return "Rechazado"
    
    todos_aprobados = all(
        (p.estado_calidad or "").strip().lower() == "aprobado" and (p.apto_consumo is True)
        for p in productos
    )
    if todos_aprobados:
        return "Aprobado"
    
    return "Pendiente"


def _producto_snapshot(p: Producto) -> dict[str, Any]:
    """Valores comparables para detectar cambios en producto."""
    return {
        "nombre": p.nombre,
        "categoria": p.categoria,
        "id_fabricante": p.id_fabricante,
        "marca": p.marca,
        "presentacion": p.presentacion,
        "lote_producto": p.lote_producto,
        "fecha_elaboracion": str(p.fecha_elaboracion) if p.fecha_elaboracion else None,
        "fecha_vencimiento": str(p.fecha_vencimiento) if p.fecha_vencimiento else None,
        "uso_recomendado": p.uso_recomendado,
        "condicion": p.condicion,
        "cantidad_tm": float(p.cantidad_tm or 0),
        "cantidad_kg": float(p.cantidad_kg or 0),
        "unidades": int(p.unidades or 0),
        "estado_calidad": p.estado_calidad,
        "apto_consumo": p.apto_consumo,
    }


def _fetch_registro_edicion(
    session: Session, id_lote: int
) -> LoteEdicionRegistroPublic | None:
    row = session.exec(
        select(Auditoria, User.full_name)
        .outerjoin(User, User.id == Auditoria.id_usuario)
        .where(Auditoria.entidad_afectada == "lote")
        .where(Auditoria.id_registro_afectado == str(id_lote))
        .where(Auditoria.accion == "EDICION_UNICA")
        .order_by(Auditoria.fecha_accion.desc())
    ).first()
    if not row:
        return None
    audit, uname = row
    det = audit.detalle if isinstance(audit.detalle, dict) else {}
    return LoteEdicionRegistroPublic(
        id_auditoria=audit.id_auditoria,
        id_usuario=audit.id_usuario,
        usuario_nombre=uname,
        fecha_modificacion=audit.fecha_accion,
        resumen=str(det.get("resumen_texto", "")),
        detalle=det,
    )


# ============================================================================
# ENDPOINTS DE LOTES
# ============================================================================

@router.get("/categorias", response_model=CategoriasPublic)
def get_categorias(current_user: CurrentUser) -> CategoriasPublic:
    """
    Obtener lista de categorías disponibles para productos.
    """
    return CategoriasPublic(categorias=CATEGORIAS_PRODUCTO)


@router.get("/catalogos", response_model=CatalogosPublic)
def get_catalogos(current_user: CurrentUser) -> CatalogosPublic:
    """
    Obtener todos los catálogos disponibles (categorías, usos recomendados, condiciones).
    """
    return CatalogosPublic(
        categorias=CATEGORIAS_PRODUCTO,
        usos_recomendados=USOS_RECOMENDADOS,
        condiciones=CONDICIONES_PRODUCTO
    )


@router.get("/", response_model=LotesPublic)
def read_lotes(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    q: str | None = None,
    estado: str | None = None,
    id_proveedor: int | None = None,
    fecha_desde: date | None = Query(default=None),
    fecha_hasta: date | None = Query(default=None),
) -> Any:
    """
    Obtener lista de lotes con filtros opcionales.
    """
    # Generate cache key con filtros
    cache_key = list_cache_key(
        "lotes",
        skip=skip,
        limit=limit,
        q=q,
        estado=estado,
        id_proveedor=id_proveedor,
        fecha_desde=str(fecha_desde) if fecha_desde else None,
        fecha_hasta=str(fecha_hasta) if fecha_hasta else None,
    )
    
    # Try to get from cache
    cached_result = get_cache(cache_key)
    if cached_result is not None:
        return LotesPublic(**cached_result)
    
    # Build base query with joins para incluir proveedor y usuario
    base_stmt = (
        select(
            Lote,
            Proveedor.nombre.label("proveedor_nombre"),
            User.full_name.label("usuario_nombre"),
        )
        .outerjoin(Proveedor, Proveedor.id_proveedor == Lote.id_proveedor)
        .outerjoin(User, User.id == Lote.id_usuario_recepcion)
    )

    # Aplicar filtros
    if id_proveedor is not None:
        lp_match = select(LoteProveedorLink.id_lote).where(
            LoteProveedorLink.id_proveedor == id_proveedor
        )
        base_stmt = base_stmt.where(
            or_(Lote.id_proveedor == id_proveedor, Lote.id_lote.in_(lp_match))
        )
    if estado:
        base_stmt = base_stmt.where(Lote.estado == estado)
    if q:
        base_stmt = base_stmt.where(Lote.numero_lote.contains(q))
    if fecha_desde is not None:
        base_stmt = base_stmt.where(Lote.fecha_llegada >= datetime.combine(fecha_desde, datetime.min.time()))
    if fecha_hasta is not None:
        base_stmt = base_stmt.where(Lote.fecha_llegada <= datetime.combine(fecha_hasta, datetime.max.time()))

    # Ordenar por fecha de llegada descendente
    base_stmt = base_stmt.order_by(Lote.fecha_llegada.desc())

    # Contar total
    count_stmt = select(func.count()).select_from(Lote)
    if id_proveedor is not None:
        lp_match_c = select(LoteProveedorLink.id_lote).where(
            LoteProveedorLink.id_proveedor == id_proveedor
        )
        count_stmt = count_stmt.where(
            or_(Lote.id_proveedor == id_proveedor, Lote.id_lote.in_(lp_match_c))
        )
    if estado:
        count_stmt = count_stmt.where(Lote.estado == estado)
    if q:
        count_stmt = count_stmt.where(Lote.numero_lote.contains(q))
    if fecha_desde is not None:
        count_stmt = count_stmt.where(Lote.fecha_llegada >= datetime.combine(fecha_desde, datetime.min.time()))
    if fecha_hasta is not None:
        count_stmt = count_stmt.where(Lote.fecha_llegada <= datetime.combine(fecha_hasta, datetime.max.time()))
    
    count = session.exec(count_stmt).one()
    
    # Ejecutar consulta principal
    results = session.exec(base_stmt.offset(skip).limit(limit)).all()
    
    # Extraer IDs de lotes para consultar productos
    lote_ids = [row[0].id_lote for row in results]
    
    # Obtener conteo de productos por lote
    productos_count: dict[int, tuple[int, int]] = {}
    productos_por_lote: dict[int, list[Producto]] = {}
    if lote_ids:
        prod_stmt = (
            select(
                Producto.id_lote,
                func.count(Producto.id_producto).label("total"),
                func.sum(Producto.unidades).label("stock")
            )
            .where(Producto.id_lote.in_(lote_ids))
            .group_by(Producto.id_lote)
        )
        for row in session.exec(prod_stmt).all():
            productos_count[row[0]] = (row[1], row[2] or 0)
        
        # Obtener productos para calcular estado_calidad
        productos_all = session.exec(select(Producto).where(Producto.id_lote.in_(lote_ids))).all()
        for p in productos_all:
            productos_por_lote.setdefault(p.id_lote, []).append(p)

    prov_por_lote = _proveedores_por_lotes(session, lote_ids)
    
    # Construir respuesta
    lotes_result = []
    for row in results:
        lote = row[0]
        proveedor_nombre = row[1]
        usuario_nombre = row[2]
        
        prod_info = productos_count.get(lote.id_lote, (0, 0))
        productos_lote = productos_por_lote.get(lote.id_lote, [])
        estado_calidad = calcular_estado_calidad_lote(productos_lote)
        plist = prov_por_lote.get(lote.id_lote, [])
        if not plist and proveedor_nombre:
            plist = [
                ProveedorEnLotePublic(
                    id_proveedor=lote.id_proveedor,
                    nombre=proveedor_nombre,
                    orden=0,
                )
            ]
        
        lotes_result.append(LotePublic(
            id_lote=lote.id_lote,
            numero_lote=lote.numero_lote,
            fecha_llegada=lote.fecha_llegada,
            fecha_registro=lote.fecha_registro,
            estado=lote.estado,
            peso_total_recibido=lote.peso_total_recibido,
            unidad_peso=lote.unidad_peso,
            observaciones=lote.observaciones,
            id_proveedor=lote.id_proveedor,
            id_usuario_recepcion=lote.id_usuario_recepcion,
            edicion_realizada=lote.edicion_realizada,
            proveedor_nombre=proveedor_nombre,
            proveedores=plist,
            usuario_recepcion_nombre=usuario_nombre,
            total_productos=prod_info[0],
            stock_total=prod_info[1],
            estado_calidad=estado_calidad,
        ))
    
    result = LotesPublic(data=lotes_result, count=count)
    
    # Cache the result (TTL: 5 minutes)
    set_cache(cache_key, result.model_dump(), ttl=300)
    
    return result


@router.get("/stats", response_model=LotesStats)
def get_lotes_stats(session: SessionDep, current_user: CurrentUser) -> LotesStats:
    """
    Obtener estadísticas de lotes.
    """
    cache_key = stats_cache_key("lotes:all")
    
    cached_result = get_cache(cache_key)
    if cached_result is not None:
        return LotesStats(**cached_result)
    
    # Total lotes
    total_lotes = session.exec(select(func.count()).select_from(Lote)).one()
    
    # Lotes activos
    activos = session.exec(
        select(func.count()).select_from(Lote).where(Lote.estado == "Activo")
    ).one()
    
    # Lotes cerrados
    cerrados = session.exec(
        select(func.count()).select_from(Lote).where(Lote.estado == "Cerrado")
    ).one()
    
    # Peso total en almacén (solo lotes activos)
    peso_total = session.exec(
        select(func.coalesce(func.sum(Lote.peso_total_recibido), 0)).where(
            Lote.estado == "Activo"
        )
    ).one()
    
    result = LotesStats(
        total_lotes=int(total_lotes),
        activos=int(activos),
        cerrados=int(cerrados),
        peso_total_almacen=float(peso_total),
        unidad_peso="kg"
    )
    
    set_cache(cache_key, result.model_dump(), ttl=60)
    
    return result


@router.get("/recientes", response_model=list[LoteReciente])
def get_lotes_recientes(
    session: SessionDep,
    current_user: CurrentUser,
    limit: int = 5
) -> list[LoteReciente]:
    """
    Obtener los lotes más recientes.
    """
    stmt = (
        select(Lote, Proveedor.nombre.label("proveedor_nombre"))
        .outerjoin(Proveedor, Proveedor.id_proveedor == Lote.id_proveedor)
        .order_by(Lote.fecha_llegada.desc())
        .limit(limit)
    )
    
    results = session.exec(stmt).all()
    
    # Obtener conteo de productos por lote y calcular estado_calidad
    lote_ids = [row[0].id_lote for row in results]
    productos_count: dict[int, int] = {}
    productos_por_lote: dict[int, list[Producto]] = {}
    if lote_ids:
        prod_stmt = (
            select(Producto.id_lote, func.count(Producto.id_producto))
            .where(Producto.id_lote.in_(lote_ids))
            .group_by(Producto.id_lote)
        )
        for row in session.exec(prod_stmt).all():
            productos_count[row[0]] = row[1]
        
        productos_all = session.exec(select(Producto).where(Producto.id_lote.in_(lote_ids))).all()
        for p in productos_all:
            productos_por_lote.setdefault(p.id_lote, []).append(p)
    
    return [
        LoteReciente(
            id_lote=row[0].id_lote,
            numero_lote=row[0].numero_lote,
            fecha_llegada=row[0].fecha_llegada,
            proveedor_nombre=row[1],
            total_productos=productos_count.get(row[0].id_lote, 0),
            estado_calidad=calcular_estado_calidad_lote(productos_por_lote.get(row[0].id_lote, [])),
        )
        for row in results
    ]


@router.get("/proximos-vencer", response_model=AlertasVencimientoPublic)
def get_productos_proximos_vencer(
    session: SessionDep,
    current_user: CurrentUser,
    dias: int | None = None
) -> AlertasVencimientoPublic:
    """
    Obtener productos próximos a vencer.
    Si no se especifica 'dias', usa la configuración del sistema.
    Solo incluye productos que tienen fecha de vencimiento.
    """
    dias_alerta = dias if dias is not None else get_dias_alerta_vencimiento(session)
    fecha_hoy = date.today()
    fecha_limite = fecha_hoy + timedelta(days=dias_alerta)
    
    # Productos activos que vencen pronto (solo los que tienen fecha de vencimiento)
    stmt = (
        select(Producto, Lote.numero_lote, Proveedor.nombre.label("proveedor_nombre"))
        .join(Lote, Lote.id_lote == Producto.id_lote)
        .outerjoin(Proveedor, Proveedor.id_proveedor == Lote.id_proveedor)
        .where(
            Producto.estado == True,
            Producto.retirado == False,
            Producto.apto_consumo == True,
            Producto.unidades > 0,
            Producto.fecha_vencimiento.isnot(None),
            Producto.fecha_vencimiento >= fecha_hoy,
            Producto.fecha_vencimiento <= fecha_limite,
        )
        .order_by(Producto.fecha_vencimiento.asc())
    )
    
    results = session.exec(stmt).all()
    
    alertas = []
    for row in results:
        producto = row[0]
        numero_lote = row[1]
        proveedor_nombre = row[2]
        dias_restantes = (producto.fecha_vencimiento - fecha_hoy).days if producto.fecha_vencimiento else 999
        
        # Determinar prioridad
        if dias_restantes <= 7:
            prioridad = "alta"
        elif dias_restantes <= 15:
            prioridad = "media"
        else:
            prioridad = "baja"
        
        alertas.append(AlertaVencimiento(
            id_producto=producto.id_producto,
            nombre=producto.nombre,
            categoria=producto.categoria,
            fecha_vencimiento=producto.fecha_vencimiento,
            dias_restantes=dias_restantes,
            unidades=producto.unidades,
            numero_lote=numero_lote,
            proveedor_nombre=proveedor_nombre,
            prioridad=prioridad
        ))
    
    return AlertasVencimientoPublic(
        data=alertas,
        count=len(alertas),
        dias_configurados=dias_alerta
    )


@router.get("/{id}", response_model=LotePublicExtended)
def read_lote(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Obtener lote por ID con productos incluidos.
    """
    cache_key = item_cache_key("lotes", id)
    
    cached_result = get_cache(cache_key)
    if cached_result is not None:
        return LotePublicExtended(**cached_result)
    
    # Obtener lote con proveedor y usuario
    stmt = (
        select(Lote, Proveedor.nombre.label("proveedor_nombre"), User.full_name.label("usuario_nombre"))
        .outerjoin(Proveedor, Proveedor.id_proveedor == Lote.id_proveedor)
        .outerjoin(User, User.id == Lote.id_usuario_recepcion)
        .where(Lote.id_lote == id)
    )
    
    result = session.exec(stmt).first()
    if not result:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    lote, proveedor_nombre, usuario_nombre = result
    
    # Obtener productos del lote
    productos_stmt = select(Producto).where(Producto.id_lote == id)
    productos = session.exec(productos_stmt).all()

    plist = _proveedores_por_lotes(session, [id]).get(id, [])
    if not plist and proveedor_nombre:
        plist = [
            ProveedorEnLotePublic(
                id_proveedor=lote.id_proveedor,
                nombre=proveedor_nombre,
                orden=0,
            )
        ]
    
    productos_public = [ProductoPublic.model_validate(p) for p in productos]
    estado_calidad = calcular_estado_calidad_lote(list(productos))
    registro_edicion = (
        _fetch_registro_edicion(session, id) if lote.edicion_realizada else None
    )

    response = LotePublicExtended(
        id_lote=lote.id_lote,
        numero_lote=lote.numero_lote,
        fecha_llegada=lote.fecha_llegada,
        fecha_registro=lote.fecha_registro,
        estado=lote.estado,
        peso_total_recibido=lote.peso_total_recibido,
        unidad_peso=lote.unidad_peso,
        observaciones=lote.observaciones,
        id_proveedor=lote.id_proveedor,
        id_usuario_recepcion=lote.id_usuario_recepcion,
        edicion_realizada=lote.edicion_realizada,
        proveedor_nombre=proveedor_nombre,
        proveedores=plist,
        usuario_recepcion_nombre=usuario_nombre,
        total_productos=len(productos),
        stock_total=sum(p.unidades for p in productos),
        estado_calidad=estado_calidad,
        productos=productos_public,
        registro_edicion=registro_edicion,
    )

    set_cache(cache_key, response.model_dump(), ttl=300)

    return response


@router.put("/{id}/edicion-unica", response_model=LotePublicExtended)
def edicion_unica_lote(
    *,
    session: SessionDep,
    current_user: CurrentSuperuser,
    id: int,
    body: LoteEdicionUnicaRequest,
) -> Any:
    """
    Edición única del lote: número, proveedor y todos los productos del lote.
    Solo se permite una vez por lote; luego `edicion_realizada` queda en True.
    El peso total del lote se recalcula como suma de (kg por unidad × unidades) por producto.
    """
    lote = session.get(Lote, id)
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    if lote.edicion_realizada:
        raise HTTPException(
            status_code=400,
            detail="Este lote ya fue editado; no se permiten más cambios.",
        )
    if lote.estado != "Activo":
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden editar lotes en estado Activo.",
        )

    ids_nuevo = _resolver_ids_edicion(body)
    if not ids_nuevo:
        raise HTTPException(
            status_code=400,
            detail="Debe indicar al menos un proveedor (id_proveedores o id_proveedor)",
        )
    for pid in ids_nuevo:
        if not session.get(Proveedor, pid):
            raise HTTPException(status_code=404, detail=f"Proveedor no encontrado (id={pid})")

    numero_enviado = sanitize_string_upper(body.numero_lote.strip()) or body.numero_lote.strip()
    numero_actual = sanitize_string_upper(lote.numero_lote.strip()) or lote.numero_lote.strip()
    if numero_enviado != numero_actual:
        raise HTTPException(
            status_code=400,
            detail="El número de lote es generado por el sistema y no puede modificarse en la edición única.",
        )

    productos_db = session.exec(select(Producto).where(Producto.id_lote == id)).all()
    ids_db = {p.id_producto for p in productos_db}
    ids_req = {item.id_producto for item in body.productos}
    if ids_db != ids_req:
        raise HTTPException(
            status_code=400,
            detail="Debe enviar exactamente un ítem por cada producto del lote (mismos IDs).",
        )

    links_antes_list = session.exec(
        select(LoteProveedorLink)
        .where(LoteProveedorLink.id_lote == id)
        .order_by(LoteProveedorLink.orden, LoteProveedorLink.id_proveedor)
    ).all()
    if links_antes_list:
        ids_antes = [ln.id_proveedor for ln in links_antes_list]
    else:
        ids_antes = [lote.id_proveedor]

    peso_antes = peso_total_lote_kg_desde_productos(list(productos_db))

    cambios_lote: dict[str, Any] = {}
    if ids_antes != ids_nuevo:
        nombres_antes = [
            (session.get(Proveedor, i).nombre if session.get(Proveedor, i) else str(i))
            for i in ids_antes
        ]
        nombres_nuevo = [
            (session.get(Proveedor, i).nombre if session.get(Proveedor, i) else str(i))
            for i in ids_nuevo
        ]
        cambios_lote["proveedores"] = {
            "antes_ids": ids_antes,
            "despues_ids": ids_nuevo,
            "proveedores_nombres_antes": nombres_antes,
            "proveedores_nombres_despues": nombres_nuevo,
        }

    by_item = {item.id_producto: item for item in body.productos}
    detalle_productos: list[dict[str, Any]] = []
    productos_con_cambio = 0

    for p in productos_db:
        item = by_item[p.id_producto]
        antes_snap = _producto_snapshot(p)
        raw = item.model_dump(exclude={"id_producto"}, exclude_unset=False)
        raw.pop("id_lote", None)
        merged = p.model_dump()
        merged.update(raw)
        san = sanitize_producto_data(merged)
        for key in ProductoUpdate.model_fields:
            if key in san and key != "id_lote":
                setattr(p, key, san[key])
        if san.get("id_fabricante"):
            fab = session.get(Fabricante, san["id_fabricante"])
            if fab:
                p.elaborado_por = sanitize_string_upper(fab.nombre)
        despues_snap = _producto_snapshot(p)
        if antes_snap != despues_snap:
            productos_con_cambio += 1
            detalle_productos.append(
                {
                    "id_producto": p.id_producto,
                    "nombre_producto": p.nombre,
                    "antes": antes_snap,
                    "despues": despues_snap,
                }
            )
        session.add(p)

    peso_despues = peso_total_lote_kg_desde_productos(list(productos_db))
    delta_peso = round(peso_despues - peso_antes, 3)

    lote.id_proveedor = ids_nuevo[0]
    lote.peso_total_recibido = peso_despues
    lote.edicion_realizada = True
    session.exec(delete(LoteProveedorLink).where(LoteProveedorLink.id_lote == lote.id_lote))
    for orden, pid in enumerate(ids_nuevo):
        session.add(
            LoteProveedorLink(
                id_lote=lote.id_lote,
                id_proveedor=pid,
                orden=orden,
            )
        )
    session.add(lote)

    partes_resumen: list[str] = []
    if "proveedores" in cambios_lote:
        cprov = cambios_lote["proveedores"]
        partes_resumen.append(
            "Proveedores: "
            f"{'; '.join(cprov['proveedores_nombres_antes'])} → "
            f"{'; '.join(cprov['proveedores_nombres_despues'])}"
        )
    for d in detalle_productos:
        na = (d.get("antes") or {}).get("nombre")
        nb = (d.get("despues") or {}).get("nombre")
        if na != nb:
            partes_resumen.append(
                f"Producto #{d.get('id_producto')}: nombre '{na}' → '{nb}'"
            )
    if productos_con_cambio:
        partes_resumen.append(
            f"Productos modificados: {productos_con_cambio} de {len(productos_db)}"
        )
    if delta_peso > 0.0001:
        partes_resumen.append(
            f"Peso total del lote: +{delta_peso} kg"
        )
    elif delta_peso < -0.0001:
        partes_resumen.append(
            f"Peso total del lote: {delta_peso} kg"
        )
    else:
        partes_resumen.append(
            "Peso total del lote: sin variación relevante"
        )

    resumen_texto = ". ".join(partes_resumen) if partes_resumen else "Edición registrada."

    detalle_audit: dict[str, Any] = {
        "resumen_texto": resumen_texto,
        "usuario_id": str(current_user.id),
        "usuario_nombre": current_user.full_name,
        "fecha_modificacion": datetime.now().isoformat(),
        "proveedor_ids": ids_nuevo,
        "lote": cambios_lote,
        "peso_kg": {
            "antes": peso_antes,
            "despues": peso_despues,
            "delta": delta_peso,
        },
        "productos_modificados": productos_con_cambio,
        "detalle_productos": detalle_productos,
    }

    audit = Auditoria(
        entidad_afectada="lote",
        id_registro_afectado=str(id),
        accion="EDICION_UNICA",
        detalle=detalle_audit,
        resultado="Éxito",
        id_usuario=current_user.id,
    )
    session.add(audit)
    session.commit()

    invalidate_entity_cache("lotes")
    invalidate_stats_cache("lotes")
    invalidate_entity_cache("productos")
    invalidate_item_cache("lotes", id)

    # Respuesta fresca (sin depender de caché GET)
    stmt = (
        select(Lote, Proveedor.nombre.label("proveedor_nombre"), User.full_name.label("usuario_nombre"))
        .outerjoin(Proveedor, Proveedor.id_proveedor == Lote.id_proveedor)
        .outerjoin(User, User.id == Lote.id_usuario_recepcion)
        .where(Lote.id_lote == id)
    )
    result = session.exec(stmt).first()
    if not result:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    lote2, proveedor_nombre, usuario_nombre = result
    productos_f = session.exec(select(Producto).where(Producto.id_lote == id)).all()
    productos_public = [ProductoPublic.model_validate(p) for p in productos_f]
    estado_calidad = calcular_estado_calidad_lote(list(productos_f))
    registro = _fetch_registro_edicion(session, id)
    plist_e = _proveedores_por_lotes(session, [id]).get(id, [])
    if not plist_e and proveedor_nombre:
        plist_e = [
            ProveedorEnLotePublic(
                id_proveedor=lote2.id_proveedor,
                nombre=proveedor_nombre,
                orden=0,
            )
        ]

    return LotePublicExtended(
        id_lote=lote2.id_lote,
        numero_lote=lote2.numero_lote,
        fecha_llegada=lote2.fecha_llegada,
        fecha_registro=lote2.fecha_registro,
        estado=lote2.estado,
        peso_total_recibido=lote2.peso_total_recibido,
        unidad_peso=lote2.unidad_peso,
        observaciones=lote2.observaciones,
        id_proveedor=lote2.id_proveedor,
        id_usuario_recepcion=lote2.id_usuario_recepcion,
        edicion_realizada=lote2.edicion_realizada,
        proveedor_nombre=proveedor_nombre,
        proveedores=plist_e,
        usuario_recepcion_nombre=usuario_nombre,
        total_productos=len(productos_f),
        stock_total=sum(p.unidades for p in productos_f),
        estado_calidad=estado_calidad,
        productos=productos_public,
        registro_edicion=registro,
    )


@router.post("/recepcion")
def recepcion_lote(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    recepcion: RecepcionRequest,
) -> Any:
    """
    Recepcionar un nuevo lote con productos.
    
    El lote registra la llegada de la carga.
    Cada producto tiene su propia fecha de vencimiento y control de calidad.
    """
    lote_in = recepcion.lote
    productos = recepcion.productos
    
    ids_prov = _resolver_ids_proveedores_recepcion(lote_in)
    if not ids_prov:
        raise HTTPException(
            status_code=400,
            detail="Debe indicar al menos un proveedor (id_proveedores o id_proveedor)",
        )
    for pid in ids_prov:
        if not session.get(Proveedor, pid):
            raise HTTPException(status_code=404, detail=f"Proveedor no encontrado (id={pid})")

    principal_id = ids_prov[0]
    proveedor = session.get(Proveedor, principal_id)
    assert proveedor is not None
    
    # Generar número de lote si no se proporciona (prefijo según proveedor principal)
    numero_lote = lote_in.numero_lote or generar_numero_lote_unico(session, principal_id)
    # Normalizar número de lote a MAYÚSCULAS si fue provisto manualmente
    numero_lote = sanitize_string_upper(numero_lote) or numero_lote
    
    # Verificar número de lote único
    existing = session.exec(select(Lote).where(Lote.numero_lote == numero_lote)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un lote con este número")
    
    # Crear el lote
    lote = Lote(
        numero_lote=numero_lote,
        id_proveedor=principal_id,
        id_usuario_recepcion=current_user.id,
        estado="Activo",
        peso_total_recibido=lote_in.peso_total_recibido,
        unidad_peso=lote_in.unidad_peso,
        observaciones=sanitize_string_upper(lote_in.observaciones),
        fecha_llegada=datetime.now(),
    )
    
    session.add(lote)
    session.commit()
    session.refresh(lote)

    for orden, pid in enumerate(ids_prov):
        session.add(
            LoteProveedorLink(
                id_lote=lote.id_lote,
                id_proveedor=pid,
                orden=orden,
            )
        )
    session.commit()
    
    productos_creados = []
    
    # Crear productos si se incluyen
    if productos:
        for prod_in in productos:
            # Sanitizar datos del producto antes de crear
            prod_dict = prod_in.model_dump()
            prod_sanitized = sanitize_producto_data(prod_dict)
            
            # Obtener nombre del fabricante si se especifica id_fabricante
            elaborado_por = prod_sanitized.get("elaborado_por")
            id_fabricante = prod_sanitized.get("id_fabricante")
            
            if id_fabricante:
                fabricante = session.get(Fabricante, id_fabricante)
                if fabricante:
                    elaborado_por = fabricante.nombre
            elaborado_por = sanitize_string_upper(elaborado_por)
            
            # Normalizar lote_producto: si es None, se guarda como None (frontend mostrará "S/L")
            lote_producto = prod_sanitized.get("lote_producto")
            if not lote_producto:
                lote_producto = None
            
            producto = Producto(
                # Información básica
                nombre=prod_sanitized.get("nombre", "") or "",
                categoria=prod_sanitized.get("categoria", "OTROS") or "OTROS",
                descripcion=prod_sanitized.get("descripcion"),
                # Fabricante
                id_fabricante=id_fabricante,
                elaborado_por=elaborado_por,
                # Marca y presentación
                marca=prod_sanitized.get("marca"),
                presentacion=prod_sanitized.get("presentacion"),
                # Lote del producto (None si está vacío)
                lote_producto=lote_producto,
                # Fechas (None si están vacías)
                fecha_elaboracion=prod_sanitized.get("fecha_elaboracion"),
                fecha_vencimiento=prod_sanitized.get("fecha_vencimiento"),
                # Uso y condición
                uso_recomendado=prod_sanitized.get("uso_recomendado", "PC DIRECTO HUMANO (PCDH)") or "PC DIRECTO HUMANO (PCDH)",
                condicion=prod_sanitized.get("condicion", "OPTIMAS CONDICIONES") or "OPTIMAS CONDICIONES",
                # Cantidades
                cantidad_tm=prod_sanitized.get("cantidad_tm", 0) or 0,
                cantidad_kg=prod_sanitized.get("cantidad_kg", 0) or 0,
                unidades=prod_sanitized.get("unidades", 0) or 0,
                # Control de calidad
                estado_calidad=prod_sanitized.get("estado_calidad", "APROBADO") or "APROBADO",
                apto_consumo=prod_sanitized.get("apto_consumo", True),
                motivo_rechazo=prod_sanitized.get("motivo_rechazo") if not prod_sanitized.get("apto_consumo", True) else None,
                # Stock
                stock_minimo=prod_sanitized.get("stock_minimo", 0) or 0,
                # Códigos opcionales
                codigo_interno=prod_sanitized.get("codigo_interno"),
                codigo_barras=prod_sanitized.get("codigo_barras"),
                # Relación con lote de recepción
                id_lote=lote.id_lote,
            )
            session.add(producto)
            session.commit()
            session.refresh(producto)
            productos_creados.append(producto.id_producto)

    # Peso total del lote = Σ (kg por unidad × unidades) por producto
    if productos_creados:
        todos = session.exec(select(Producto).where(Producto.id_lote == lote.id_lote)).all()
        lote.peso_total_recibido = peso_total_lote_kg_desde_productos(list(todos))
        session.add(lote)
        session.commit()
        session.refresh(lote)

    # Auditoría
    audit = Auditoria(
        entidad_afectada="lote",
        id_registro_afectado=str(lote.id_lote),
        accion="RECEPCION",
        detalle={
            "numero_lote": lote.numero_lote,
            "proveedor_id": lote.id_proveedor,
            "proveedor_ids": ids_prov,
            "peso_total": lote.peso_total_recibido,
            "unidad_peso": lote.unidad_peso,
            "productos_creados": len(productos_creados),
        },
        resultado="Éxito",
        id_usuario=current_user.id,
    )
    session.add(audit)
    session.commit()
    
    # Invalidar caches
    invalidate_entity_cache("lotes")
    invalidate_stats_cache("lotes")
    invalidate_entity_cache("productos")
    
    return {
        "message": "Lote recepcionado exitosamente",
        "lote": LotePublic(
            id_lote=lote.id_lote,
            numero_lote=lote.numero_lote,
            fecha_llegada=lote.fecha_llegada,
            fecha_registro=lote.fecha_registro,
            estado=lote.estado,
            peso_total_recibido=lote.peso_total_recibido,
            unidad_peso=lote.unidad_peso,
            observaciones=lote.observaciones,
            id_proveedor=lote.id_proveedor,
            id_usuario_recepcion=lote.id_usuario_recepcion,
            edicion_realizada=lote.edicion_realizada,
            proveedor_nombre=proveedor.nombre,
            proveedores=_proveedores_por_lotes(session, [lote.id_lote]).get(lote.id_lote, []),
            usuario_recepcion_nombre=current_user.full_name,
            total_productos=len(productos_creados),
            stock_total=sum(p.unidades for p in productos) if productos else 0,
        ),
        "productos_ids": productos_creados,
    }


@router.put("/{id}", response_model=LotePublic)
def update_lote(
    *,
    session: SessionDep,
    current_user: CurrentSuperuser,
    id: int,
    lote_in: LoteUpdate,
) -> Any:
    """
    Actualizar un lote existente.
    """
    lote = session.get(Lote, id)
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    update_dict = lote_in.model_dump(exclude_unset=True)

    if lote.edicion_realizada:
        bloqueados = {"numero_lote", "id_proveedor", "peso_total_recibido", "unidad_peso"}
        if bloqueados & set(update_dict.keys()):
            raise HTTPException(
                status_code=400,
                detail="Este lote ya fue editado con la edición única; no se pueden "
                "modificar número, proveedor ni peso por este endpoint.",
            )

    # Validar proveedor si se actualiza
    if "id_proveedor" in update_dict:
        proveedor = session.get(Proveedor, update_dict["id_proveedor"])
        if not proveedor:
            raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    
    # Validar número de lote único
    if "numero_lote" in update_dict and update_dict["numero_lote"] != lote.numero_lote:
        existing = session.exec(
            select(Lote).where(Lote.numero_lote == update_dict["numero_lote"])
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un lote con este número")
    
    lote.sqlmodel_update(update_dict)
    if "id_proveedor" in update_dict and lote.id_lote is not None:
        session.exec(delete(LoteProveedorLink).where(LoteProveedorLink.id_lote == lote.id_lote))
        session.add(
            LoteProveedorLink(
                id_lote=lote.id_lote,
                id_proveedor=lote.id_proveedor,
                orden=0,
            )
        )
    session.add(lote)
    session.commit()
    session.refresh(lote)
    
    # Invalidar cache
    invalidate_entity_cache("lotes")
    invalidate_stats_cache("lotes")
    
    # Obtener datos relacionados
    proveedor = session.get(Proveedor, lote.id_proveedor)
    usuario = session.get(User, lote.id_usuario_recepcion) if lote.id_usuario_recepcion else None
    
    productos_count = session.exec(
        select(func.count(), func.sum(Producto.unidades))
        .where(Producto.id_lote == id)
    ).one()
    prods_ec = session.exec(select(Producto).where(Producto.id_lote == id)).all()
    estado_calidad_ec = calcular_estado_calidad_lote(list(prods_ec))
    plist_u = _proveedores_por_lotes(session, [id]).get(id, [])
    if not plist_u and proveedor:
        plist_u = [
            ProveedorEnLotePublic(id_proveedor=lote.id_proveedor, nombre=proveedor.nombre, orden=0)
        ]

    return LotePublic(
        id_lote=lote.id_lote,
        numero_lote=lote.numero_lote,
        fecha_llegada=lote.fecha_llegada,
        fecha_registro=lote.fecha_registro,
        estado=lote.estado,
        peso_total_recibido=lote.peso_total_recibido,
        unidad_peso=lote.unidad_peso,
        observaciones=lote.observaciones,
        id_proveedor=lote.id_proveedor,
        id_usuario_recepcion=lote.id_usuario_recepcion,
        edicion_realizada=lote.edicion_realizada,
        proveedor_nombre=proveedor.nombre if proveedor else None,
        proveedores=plist_u,
        usuario_recepcion_nombre=usuario.full_name if usuario else None,
        total_productos=productos_count[0] or 0,
        stock_total=productos_count[1] or 0,
        estado_calidad=estado_calidad_ec,
    )


@router.delete("/{id}")
def delete_lote(session: SessionDep, current_user: CurrentSuperuser, id: int) -> Any:
    """
    Marcar un lote como cerrado (soft delete).
    """
    lote = session.get(Lote, id)
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    lote.estado = "Cerrado"
    session.add(lote)
    session.commit()
    
    # Auditoría
    audit = Auditoria(
        entidad_afectada="lote",
        id_registro_afectado=str(id),
        accion="DELETE",
        detalle={"numero_lote": lote.numero_lote},
        resultado="Éxito",
        id_usuario=current_user.id,
    )
    session.add(audit)
    session.commit()
    
    invalidate_entity_cache("lotes")
    invalidate_stats_cache("lotes")
    
    return {"message": "Lote marcado como cerrado"}


@router.delete("/{id}/force")
def force_delete_lote(
    session: SessionDep, current_user: CurrentSuperuser, id: int
) -> Any:
    """
    Eliminar un lote de forma definitiva (hard delete).
    
    Esta operación elimina el lote y todos los productos asociados.
    Úsese solo cuando se trate de lotes de prueba o sin relevancia histórica.
    """
    lote = session.get(Lote, id)
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    # Eliminar productos asociados al lote
    productos_stmt = select(Producto).where(Producto.id_lote == id)
    productos = session.exec(productos_stmt).all()
    total_productos = len(productos)
    total_unidades = sum(p.unidades for p in productos) if productos else 0
    
    for producto in productos:
        session.delete(producto)
    
    # Eliminar el lote
    session.delete(lote)
    session.commit()
    
    # Auditoría
    audit = Auditoria(
        entidad_afectada="lote",
        id_registro_afectado=str(id),
        accion="FORCE_DELETE",
        detalle={
            "numero_lote": lote.numero_lote if lote else None,
            "total_productos_eliminados": total_productos,
            "total_unidades_eliminadas": total_unidades,
        },
        resultado="Éxito",
        id_usuario=current_user.id,
    )
    session.add(audit)
    session.commit()
    
    invalidate_entity_cache("lotes")
    invalidate_stats_cache("lotes")
    invalidate_entity_cache("productos")
    
    return {"message": "Lote eliminado definitivamente"}
