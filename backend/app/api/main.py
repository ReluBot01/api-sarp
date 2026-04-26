from fastapi import APIRouter

from app.api.routes import (
    auditorias,
    configuracion,
    fabricantes,
    items,
    lotes,
    login,
    private,
    productos,
    reportes,
    proveedores,
    users,
    utils,
)
from app.core.config import settings

api_router = APIRouter()

# Rutas de autenticación y utilidades
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)
api_router.include_router(items.router)

# Rutas del sistema de inventario de almacén
api_router.include_router(configuracion.router)
api_router.include_router(proveedores.router)
api_router.include_router(fabricantes.router)
api_router.include_router(lotes.router)
api_router.include_router(productos.router)
api_router.include_router(reportes.router)
api_router.include_router(auditorias.router)

if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
