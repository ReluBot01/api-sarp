from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select, or_

from app.api.deps import CurrentSuperuser, CurrentUser, SessionDep
from app.core.cache import (
    get_cache, set_cache, invalidate_entity_cache, 
    list_cache_key, item_cache_key, stats_cache_key
)
from app.models import (
    Message,
    Proveedor,
    ProveedorCreate,
    ProveedorPublic,
    ProveedoresPublic,
    ProveedorUpdate,
    Lote,
)
from app.utils import sanitize_proveedor_data, validate_rif_format, format_rif, sanitize_telefono

router = APIRouter(prefix="/proveedores", tags=["proveedores"])


@router.get("/", response_model=ProveedoresPublic)
def read_proveedores(
    session: SessionDep, 
    current_user: CurrentUser, 
    skip: int = 0, 
    limit: int = 100,
    q: str | None = None,
    estado: bool | None = None
) -> Any:
    """
    Obtener lista de proveedores con búsqueda y filtros opcionales.
    """
    cache_key = list_cache_key("proveedores", skip=skip, limit=limit, q=q, estado=estado)
    
    cached_result = get_cache(cache_key)
    if cached_result is not None:
        return ProveedoresPublic(**cached_result)
    
    # Query base: proveedores + agregados (total_lotes, ultima_entrega)
    statement = (
        select(
            Proveedor,
            func.count(Lote.id_lote).label("total_lotes"),
            func.max(Lote.fecha_llegada).label("ultima_entrega"),
        )
        .outerjoin(Lote, Lote.id_proveedor == Proveedor.id_proveedor)
        .group_by(Proveedor.id_proveedor)
    )
    count_statement = select(func.count()).select_from(Proveedor)
    
    filters = []
    
    if q:
        search_filter = or_(
            Proveedor.nombre.ilike(f"%{q}%"),
            Proveedor.rif.ilike(f"%{q}%"),
            Proveedor.email.ilike(f"%{q}%"),
            Proveedor.telefono.ilike(f"%{q}%")
        )
        filters.append(search_filter)
    
    if estado is not None:
        filters.append(Proveedor.estado == estado)
    
    if filters:
        statement = statement.where(*filters)
        count_statement = count_statement.where(*filters)
    
    count = session.exec(count_statement).one()
    statement = statement.order_by(Proveedor.nombre).offset(skip).limit(limit)
    rows = session.exec(statement).all()
    
    proveedores_public: list[ProveedorPublic] = []
    for proveedor, total_lotes, ultima_entrega in rows:
        proveedores_public.append(
            ProveedorPublic(
                id_proveedor=proveedor.id_proveedor,
                nombre=proveedor.nombre,
                rif=proveedor.rif,
                telefono=proveedor.telefono,
                email=proveedor.email,
                direccion=proveedor.direccion,
                ciudad=proveedor.ciudad,
                estado=proveedor.estado,
                fecha_creacion=proveedor.fecha_creacion,
                total_lotes=int(total_lotes or 0),
                ultima_entrega=ultima_entrega,
            )
        )
    
    result = ProveedoresPublic(data=proveedores_public, count=count)
    
    set_cache(cache_key, result.model_dump(), ttl=300)
    
    return result


@router.get("/stats")
def get_proveedores_stats(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Obtener estadísticas de proveedores.
    """
    cache_key = stats_cache_key("proveedores")
    
    cached_result = get_cache(cache_key)
    if cached_result is not None:
        return cached_result
    
    total_proveedores = session.exec(select(func.count()).select_from(Proveedor)).one()
    
    activos = session.exec(
        select(func.count()).select_from(Proveedor).where(Proveedor.estado == True)
    ).one()
    
    inactivos = session.exec(
        select(func.count()).select_from(Proveedor).where(Proveedor.estado == False)
    ).one()
    
    from app.models import Lote
    total_lotes = session.exec(select(func.count()).select_from(Lote)).one()
    
    result = {
        "total_proveedores": total_proveedores,
        "activos": activos,
        "inactivos": inactivos,
        "total_lotes": total_lotes
    }
    
    set_cache(cache_key, result, ttl=60)
    
    return result


@router.get("/{id}", response_model=ProveedorPublic)
def read_proveedor(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Obtener proveedor por ID.
    """
    cache_key = item_cache_key("proveedores", id)
    
    cached_result = get_cache(cache_key)
    if cached_result is not None:
        return ProveedorPublic(**cached_result)
    
    proveedor = session.get(Proveedor, id)
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    
    set_cache(cache_key, proveedor.model_dump(), ttl=300)
    
    return proveedor


@router.post("/", response_model=ProveedorPublic)
def create_proveedor(
    *, session: SessionDep, current_user: CurrentUser, proveedor_in: ProveedorCreate
) -> Any:
    """
    Crear nuevo proveedor.
    """
    # Sanitizar datos antes de validar
    proveedor_dict = proveedor_in.model_dump()
    proveedor_sanitized = sanitize_proveedor_data(proveedor_dict)
    
    # Validar que nombre y RIF no estén vacíos después de sanitizar
    if not proveedor_sanitized.get("nombre"):
        raise HTTPException(status_code=400, detail="El nombre del proveedor es requerido")
    if not proveedor_sanitized.get("rif"):
        raise HTTPException(status_code=400, detail="El RIF del proveedor es requerido")
    
    # Formatear y validar RIF
    rif_formatted = format_rif(proveedor_sanitized.get("rif"))
    if not rif_formatted:
        raise HTTPException(status_code=400, detail="El RIF del proveedor es requerido")
    
    if not validate_rif_format(rif_formatted):
        raise HTTPException(
            status_code=400,
            detail="Formato de RIF inválido. Debe ser: [V|J|G|E|C|P]-[8 dígitos]-[1 dígito]. Ejemplo: J-12345678-9"
        )
    
    proveedor_sanitized["rif"] = rif_formatted
    
    # Validar teléfono si se proporciona
    if "telefono" in proveedor_sanitized and proveedor_sanitized.get("telefono"):
        telefono_cleaned = sanitize_telefono(proveedor_sanitized["telefono"])
        if telefono_cleaned and len(telefono_cleaned) > 11:
            raise HTTPException(
                status_code=400,
                detail="El teléfono no puede exceder 11 dígitos"
            )
        if telefono_cleaned and not telefono_cleaned.isdigit():
            raise HTTPException(
                status_code=400,
                detail="El teléfono solo puede contener números"
            )
        proveedor_sanitized["telefono"] = telefono_cleaned
    
    existing_proveedor = session.exec(
        select(Proveedor).where(Proveedor.rif == rif_formatted)
    ).first()
    
    if existing_proveedor:
        raise HTTPException(
            status_code=400, 
            detail=f"Ya existe un proveedor con el RIF {rif_formatted}"
        )
    
    proveedor = Proveedor.model_validate(proveedor_sanitized)
    session.add(proveedor)
    session.commit()
    session.refresh(proveedor)
    
    invalidate_entity_cache("proveedores")
    
    return proveedor


@router.put("/{id}", response_model=ProveedorPublic)
def update_proveedor(
    *,
    session: SessionDep,
    current_user: CurrentSuperuser,
    id: int,
    proveedor_in: ProveedorUpdate,
) -> Any:
    """
    Actualizar un proveedor.
    """
    proveedor = session.get(Proveedor, id)
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    
    update_dict = proveedor_in.model_dump(exclude_unset=True)
    update_dict = sanitize_proveedor_data(update_dict)
    
    # Validar y formatear RIF si se actualiza
    if "rif" in update_dict and update_dict["rif"]:
        rif_formatted = format_rif(update_dict["rif"])
        if not rif_formatted:
            raise HTTPException(status_code=400, detail="El RIF no puede estar vacío")
        
        if not validate_rif_format(rif_formatted):
            raise HTTPException(
                status_code=400,
                detail="Formato de RIF inválido. Debe ser: [V|J|G|E|C|P]-[8 dígitos]-[1 dígito]. Ejemplo: J-12345678-9"
            )
        
        update_dict["rif"] = rif_formatted
        
        if rif_formatted != proveedor.rif:
            existing_proveedor = session.exec(
                select(Proveedor).where(Proveedor.rif == rif_formatted)
            ).first()
            
            if existing_proveedor:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Ya existe un proveedor con el RIF {rif_formatted}"
                )
    
    # Validar teléfono si se actualiza
    if "telefono" in update_dict and update_dict.get("telefono"):
        telefono_cleaned = sanitize_telefono(update_dict["telefono"])
        if telefono_cleaned and len(telefono_cleaned) > 11:
            raise HTTPException(
                status_code=400,
                detail="El teléfono no puede exceder 11 dígitos"
            )
        if telefono_cleaned and not telefono_cleaned.isdigit():
            raise HTTPException(
                status_code=400,
                detail="El teléfono solo puede contener números"
            )
        update_dict["telefono"] = telefono_cleaned
    
    proveedor.sqlmodel_update(update_dict)
    session.add(proveedor)
    session.commit()
    session.refresh(proveedor)
    
    invalidate_entity_cache("proveedores")
    
    return proveedor


@router.delete("/{id}")
def delete_proveedor(
    session: SessionDep, current_user: CurrentSuperuser, id: int
) -> Message:
    """
    Eliminar un proveedor (soft delete).
    """
    proveedor = session.get(Proveedor, id)
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    proveedor.estado = False
    session.add(proveedor)
    session.commit()
    
    invalidate_entity_cache("proveedores")
    
    return Message(message="Proveedor eliminado exitosamente")


@router.delete("/{id}/force")
def force_delete_proveedor(
    session: SessionDep, current_user: CurrentSuperuser, id: int
) -> Message:
    """
    Eliminar un proveedor de forma definitiva (hard delete).
    
    Solo se permite si el proveedor no tiene lotes asociados.
    """
    proveedor = session.get(Proveedor, id)
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    
    # Verificar si existen lotes asociados a este proveedor
    lote_existente = session.exec(
        select(Lote).where(Lote.id_proveedor == id)
    ).first()
    if lote_existente:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar el proveedor porque tiene lotes asociados. "
            "Cierre o reasigne los lotes primero.",
        )
    
    session.delete(proveedor)
    session.commit()
    
    invalidate_entity_cache("proveedores")
    
    return Message(message="Proveedor eliminado definitivamente")
