from typing import Any
from datetime import date, datetime

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Auditoria,
    AuditoriaPublic,
    AuditoriasPublic,
    User,
)

router = APIRouter(prefix="/auditorias", tags=["auditorias"])


@router.get("/", response_model=AuditoriasPublic)
def read_auditorias(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    entidad: str | None = None,
    accion: str | None = None,
    fecha_desde: date | None = Query(default=None),
    fecha_hasta: date | None = Query(default=None),
) -> Any:
    """
    Obtener lista de registros de auditoría con filtros opcionales.
    """
    # Base query con join a usuario
    stmt = (
        select(Auditoria, User.full_name.label("usuario_nombre"))
        .outerjoin(User, User.id == Auditoria.id_usuario)
    )
    
    # Aplicar filtros
    if entidad:
        stmt = stmt.where(Auditoria.entidad_afectada == entidad)
    if accion:
        stmt = stmt.where(Auditoria.accion == accion)
    if fecha_desde:
        stmt = stmt.where(Auditoria.fecha_accion >= datetime.combine(fecha_desde, datetime.min.time()))
    if fecha_hasta:
        stmt = stmt.where(Auditoria.fecha_accion <= datetime.combine(fecha_hasta, datetime.max.time()))
    
    # Ordenar por fecha descendente
    stmt = stmt.order_by(Auditoria.fecha_accion.desc())
    
    # Contar total
    count_stmt = select(func.count()).select_from(Auditoria)
    if entidad:
        count_stmt = count_stmt.where(Auditoria.entidad_afectada == entidad)
    if accion:
        count_stmt = count_stmt.where(Auditoria.accion == accion)
    if fecha_desde:
        count_stmt = count_stmt.where(Auditoria.fecha_accion >= datetime.combine(fecha_desde, datetime.min.time()))
    if fecha_hasta:
        count_stmt = count_stmt.where(Auditoria.fecha_accion <= datetime.combine(fecha_hasta, datetime.max.time()))
    
    count = session.exec(count_stmt).one()
    
    # Ejecutar query
    results = session.exec(stmt.offset(skip).limit(limit)).all()
    
    # Construir respuesta
    auditorias = []
    for row in results:
        auditoria = row[0]
        usuario_nombre = row[1]
        
        auditorias.append(AuditoriaPublic(
            id_auditoria=auditoria.id_auditoria,
            entidad_afectada=auditoria.entidad_afectada,
            id_registro_afectado=auditoria.id_registro_afectado,
            accion=auditoria.accion,
            detalle=auditoria.detalle,
            resultado=auditoria.resultado,
            id_usuario=auditoria.id_usuario,
            fecha_accion=auditoria.fecha_accion,
            usuario_nombre=usuario_nombre,
        ))
    
    return AuditoriasPublic(data=auditorias, count=count)


@router.get("/entidades")
def get_entidades_disponibles(session: SessionDep, current_user: CurrentUser) -> list[str]:
    """
    Obtener lista de entidades registradas en auditoría.
    """
    stmt = select(Auditoria.entidad_afectada).distinct()
    entidades = session.exec(stmt).all()
    return list(entidades)


@router.get("/acciones")
def get_acciones_disponibles(session: SessionDep, current_user: CurrentUser) -> list[str]:
    """
    Obtener lista de acciones registradas en auditoría.
    """
    stmt = select(Auditoria.accion).distinct()
    acciones = session.exec(stmt).all()
    return list(acciones)


@router.get("/{id}", response_model=AuditoriaPublic)
def read_auditoria(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Obtener registro de auditoría por ID.
    """
    stmt = (
        select(Auditoria, User.full_name.label("usuario_nombre"))
        .outerjoin(User, User.id == Auditoria.id_usuario)
        .where(Auditoria.id_auditoria == id)
    )
    
    result = session.exec(stmt).first()
    if not result:
        raise HTTPException(status_code=404, detail="Registro de auditoría no encontrado")
    
    auditoria, usuario_nombre = result
    
    return AuditoriaPublic(
        id_auditoria=auditoria.id_auditoria,
        entidad_afectada=auditoria.entidad_afectada,
        id_registro_afectado=auditoria.id_registro_afectado,
        accion=auditoria.accion,
        detalle=auditoria.detalle,
        resultado=auditoria.resultado,
        id_usuario=auditoria.id_usuario,
        fecha_accion=auditoria.fecha_accion,
        usuario_nombre=usuario_nombre,
    )
