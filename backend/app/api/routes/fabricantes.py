from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentSuperuser, CurrentUser, SessionDep
from app.models import (
    Message,
    Fabricante,
    FabricanteCreate,
    FabricantePublic,
    FabricantesPublic,
    FabricanteUpdate,
    Auditoria,
    Producto,
)
from app.utils import sanitize_fabricante_data, validate_rif_format, format_rif, sanitize_telefono

router = APIRouter(prefix="/fabricantes", tags=["fabricantes"])


@router.get("/", response_model=FabricantesPublic)
def read_fabricantes(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    q: str | None = None,
    solo_activos: bool = False,
) -> Any:
    """
    Obtener lista de fabricantes.
    
    - q: Buscar por nombre o RIF
    - solo_activos: Si es True, solo retorna fabricantes activos
    """
    stmt = select(Fabricante)
    
    if solo_activos:
        stmt = stmt.where(Fabricante.estado == True)
    
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (Fabricante.nombre.ilike(like))
            | (Fabricante.rif.ilike(like))
        )
    
    stmt = stmt.order_by(Fabricante.nombre.asc())
    
    # Count total
    count_stmt = select(func.count()).select_from(Fabricante)
    if solo_activos:
        count_stmt = count_stmt.where(Fabricante.estado == True)
    if q:
        count_stmt = count_stmt.where(
            (Fabricante.nombre.ilike(f"%{q}%"))
            | (Fabricante.rif.ilike(f"%{q}%"))
        )
    
    count = session.exec(count_stmt).one()
    fabricantes = session.exec(stmt.offset(skip).limit(limit)).all()
    
    return FabricantesPublic(data=fabricantes, count=count)


@router.get("/activos", response_model=FabricantesPublic)
def read_fabricantes_activos(
    session: SessionDep,
    current_user: CurrentUser,
    q: str | None = None,
) -> Any:
    """
    Obtener lista de fabricantes activos (para selectores).
    """
    stmt = select(Fabricante).where(Fabricante.estado == True)
    
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (Fabricante.nombre.ilike(like))
            | (Fabricante.rif.ilike(like))
        )
    
    stmt = stmt.order_by(Fabricante.nombre.asc())
    
    fabricantes = session.exec(stmt).all()
    
    return FabricantesPublic(data=fabricantes, count=len(fabricantes))


@router.get("/{id}", response_model=FabricantePublic)
def read_fabricante(
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
) -> Any:
    """
    Obtener fabricante por ID.
    """
    fabricante = session.get(Fabricante, id)
    if not fabricante:
        raise HTTPException(status_code=404, detail="Fabricante no encontrado")
    return fabricante


@router.post("/", response_model=FabricantePublic)
def create_fabricante(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    fabricante_in: FabricanteCreate,
) -> Any:
    """
    Crear nuevo fabricante.
    """
    # Sanitizar datos antes de validar
    fabricante_dict = fabricante_in.model_dump()
    fabricante_sanitized = sanitize_fabricante_data(fabricante_dict)
    
    # Validar que nombre y RIF no estén vacíos después de sanitizar
    if not fabricante_sanitized.get("nombre"):
        raise HTTPException(status_code=400, detail="El nombre del fabricante es requerido")
    if not fabricante_sanitized.get("rif"):
        raise HTTPException(status_code=400, detail="El RIF del fabricante es requerido")
    
    # Formatear y validar RIF
    rif_formatted = format_rif(fabricante_sanitized.get("rif"))
    if not rif_formatted:
        raise HTTPException(status_code=400, detail="El RIF del fabricante es requerido")
    
    if not validate_rif_format(rif_formatted):
        raise HTTPException(
            status_code=400,
            detail="Formato de RIF inválido. Debe ser: [V|J|G|E|C|P]-[8 dígitos]-[1 dígito]. Ejemplo: J-12345678-9"
        )
    
    fabricante_sanitized["rif"] = rif_formatted
    
    # Validar teléfono si se proporciona
    if "telefono" in fabricante_sanitized and fabricante_sanitized.get("telefono"):
        telefono_cleaned = sanitize_telefono(fabricante_sanitized["telefono"])
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
        fabricante_sanitized["telefono"] = telefono_cleaned
    
    # Verificar RIF único
    existing = session.exec(
        select(Fabricante).where(Fabricante.rif == rif_formatted)
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe un fabricante con el RIF {rif_formatted}"
        )
    
    fabricante = Fabricante.model_validate(fabricante_sanitized)
    session.add(fabricante)
    session.commit()
    session.refresh(fabricante)
    
    # Auditoría
    audit = Auditoria(
        entidad_afectada="fabricante",
        id_registro_afectado=str(fabricante.id_fabricante),
        accion="CREATE",
        detalle={
            "nombre": fabricante.nombre,
            "rif": fabricante.rif,
        },
        resultado="Éxito",
        id_usuario=current_user.id,
    )
    session.add(audit)
    session.commit()
    
    return fabricante


@router.put("/{id}", response_model=FabricantePublic)
def update_fabricante(
    *,
    session: SessionDep,
    current_user: CurrentSuperuser,
    id: int,
    fabricante_in: FabricanteUpdate,
) -> Any:
    """
    Actualizar fabricante.
    """
    fabricante = session.get(Fabricante, id)
    if not fabricante:
        raise HTTPException(status_code=404, detail="Fabricante no encontrado")
    
    update_dict = fabricante_in.model_dump(exclude_unset=True)
    update_dict = sanitize_fabricante_data(update_dict)
    
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
    
    # Verificar RIF único si se actualiza
    if "rif" in update_dict and update_dict.get("rif"):
        rif_formatted = update_dict["rif"]
        if rif_formatted != fabricante.rif:
            existing = session.exec(
                select(Fabricante).where(Fabricante.rif == rif_formatted)
            ).first()
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Ya existe un fabricante con el RIF {rif_formatted}"
                )
    
    fabricante.sqlmodel_update(update_dict)
    session.add(fabricante)
    session.commit()
    session.refresh(fabricante)
    
    # Auditoría
    audit = Auditoria(
        entidad_afectada="fabricante",
        id_registro_afectado=str(id),
        accion="UPDATE",
        detalle=update_dict,
        resultado="Éxito",
        id_usuario=current_user.id,
    )
    session.add(audit)
    session.commit()
    
    return fabricante


@router.patch("/{id}/toggle-estado")
def toggle_estado_fabricante(
    *,
    session: SessionDep,
    current_user: CurrentSuperuser,
    id: int,
) -> Any:
    """
    Activar/Desactivar fabricante.
    """
    fabricante = session.get(Fabricante, id)
    if not fabricante:
        raise HTTPException(status_code=404, detail="Fabricante no encontrado")
    
    estado_anterior = fabricante.estado
    fabricante.estado = not fabricante.estado
    session.add(fabricante)
    session.commit()
    session.refresh(fabricante)
    
    # Auditoría
    audit = Auditoria(
        entidad_afectada="fabricante",
        id_registro_afectado=str(id),
        accion="TOGGLE_ESTADO",
        detalle={
            "estado_anterior": estado_anterior,
            "estado_nuevo": fabricante.estado,
        },
        resultado="Éxito",
        id_usuario=current_user.id,
    )
    session.add(audit)
    session.commit()
    
    return {
        "message": f"Fabricante {'activado' if fabricante.estado else 'desactivado'} exitosamente",
        "estado": fabricante.estado,
    }


@router.delete("/{id}")
def delete_fabricante(
    session: SessionDep,
    current_user: CurrentSuperuser,
    id: int,
) -> Message:
    """
    Eliminar fabricante (soft delete - desactivar).
    """
    fabricante = session.get(Fabricante, id)
    if not fabricante:
        raise HTTPException(status_code=404, detail="Fabricante no encontrado")
    
    fabricante.estado = False
    session.add(fabricante)
    session.commit()
    
    # Auditoría
    audit = Auditoria(
        entidad_afectada="fabricante",
        id_registro_afectado=str(id),
        accion="DELETE",
        detalle={"nombre": fabricante.nombre},
        resultado="Éxito",
        id_usuario=current_user.id,
    )
    session.add(audit)
    session.commit()
    
    return Message(message="Fabricante eliminado exitosamente")


@router.delete("/{id}/force")
def force_delete_fabricante(
    session: SessionDep,
    current_user: CurrentSuperuser,
    id: int,
) -> Message:
    """
    Eliminar fabricante de forma definitiva (hard delete).
    
    Solo se permite si no existen productos asociados a este fabricante.
    """
    fabricante = session.get(Fabricante, id)
    if not fabricante:
        raise HTTPException(status_code=404, detail="Fabricante no encontrado")
    
    # Verificar si existen productos asociados a este fabricante
    producto_existente = session.exec(
        select(Producto).where(Producto.id_fabricante == id)
    ).first()
    if producto_existente:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar el fabricante porque tiene productos asociados. "
            "Reasigna o elimina los productos primero.",
        )
    
    session.delete(fabricante)
    session.commit()
    
    # Auditoría
    audit = Auditoria(
        entidad_afectada="fabricante",
        id_registro_afectado=str(id),
        accion="FORCE_DELETE",
        detalle={"nombre": fabricante.nombre, "rif": fabricante.rif},
        resultado="Éxito",
        id_usuario=current_user.id,
    )
    session.add(audit)
    session.commit()
    
    return Message(message="Fabricante eliminado definitivamente")
