from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from app.api.deps import CurrentSuperuser, CurrentUser, SessionDep
from app.core.constants import DEFAULT_DIAS_ALERTA_VENCIMIENTO
from app.models import (
    ConfiguracionSistema,
    ConfiguracionSistemaCreate,
    ConfiguracionSistemaUpdate,
    ConfiguracionSistemaPublic,
)
from datetime import datetime

router = APIRouter(prefix="/configuracion", tags=["configuracion"])


def get_or_create_config(session: SessionDep) -> ConfiguracionSistema:
    """Obtiene la configuración existente o crea una nueva con valores por defecto."""
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


@router.get("/", response_model=ConfiguracionSistemaPublic)
def get_configuracion(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Obtener la configuración del sistema.
    Si no existe, se crea una con valores por defecto.
    """
    config = get_or_create_config(session)
    return config


@router.put("/", response_model=ConfiguracionSistemaPublic)
def update_configuracion(
    *,
    session: SessionDep,
    current_user: CurrentSuperuser,
    config_in: ConfiguracionSistemaUpdate
) -> Any:
    """
    Actualizar la configuración del sistema.
    """
    config = get_or_create_config(session)
    
    update_dict = config_in.model_dump(exclude_unset=True)
    
    # Validar días de alerta
    if "dias_alerta_vencimiento" in update_dict:
        if update_dict["dias_alerta_vencimiento"] < 1:
            raise HTTPException(
                status_code=400,
                detail="Los días de alerta deben ser al menos 1"
            )
    
    # Validar unidad de peso
    if "unidad_peso_defecto" in update_dict:
        unidades_validas = ["toneladas", "kg", "gr"]
        if update_dict["unidad_peso_defecto"] not in unidades_validas:
            raise HTTPException(
                status_code=400,
                detail=f"Unidad de peso no válida. Use: {', '.join(unidades_validas)}"
            )
    
    config.sqlmodel_update(update_dict)
    config.fecha_actualizacion = datetime.now()
    
    session.add(config)
    session.commit()
    session.refresh(config)
    
    return config
