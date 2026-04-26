"""
Utilidades para generación de templates de email y tokens JWT.

Este módulo se encarga de:
- Renderizar templates de email con Jinja2
- Generar tokens JWT para reset de contraseña
- Generar contenido de emails (reset password, new account, test)

El envío real de correos se maneja en app.services.email_service
"""
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone, date
from pathlib import Path
from typing import Any

import jwt
from jinja2 import Template
from jwt.exceptions import InvalidTokenError

from app.core import security
from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class EmailData:
    html_content: str
    subject: str


def render_email_template(*, template_name: str, context: dict[str, Any]) -> str:
    template_str = (
        Path(__file__).parent / "email-templates" / "build" / template_name
    ).read_text()
    html_content = Template(template_str).render(context)
    return html_content




def generate_test_email(email_to: str) -> EmailData:
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - Test email"
    html_content = render_email_template(
        template_name="test_email.html",
        context={"project_name": settings.PROJECT_NAME, "email": email_to},
    )
    return EmailData(html_content=html_content, subject=subject)


def generate_reset_password_email(email_to: str, email: str, token: str) -> EmailData:
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - Password recovery for user {email}"
    link = f"{settings.FRONTEND_HOST}/reset-password?token={token}"
    html_content = render_email_template(
        template_name="reset_password.html",
        context={
            "project_name": settings.PROJECT_NAME,
            "username": email,
            "email": email_to,
            "valid_hours": settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS,
            "link": link,
        },
    )
    return EmailData(html_content=html_content, subject=subject)


def generate_new_account_email(
    email_to: str, username: str, password: str
) -> EmailData:
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - New account for user {username}"
    html_content = render_email_template(
        template_name="new_account.html",
        context={
            "project_name": settings.PROJECT_NAME,
            "username": username,
            "password": password,
            "email": email_to,
            "link": settings.FRONTEND_HOST,
        },
    )
    return EmailData(html_content=html_content, subject=subject)


def generate_password_reset_token(email: str) -> str:
    delta = timedelta(hours=settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS)
    now = datetime.now(timezone.utc)
    expires = now + delta
    exp = expires.timestamp()
    encoded_jwt = jwt.encode(
        {"exp": exp, "nbf": now, "sub": email},
        settings.SECRET_KEY,
        algorithm=security.ALGORITHM,
    )
    return encoded_jwt


def verify_password_reset_token(token: str) -> str | None:
    try:
        decoded_token = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        return str(decoded_token["sub"])
    except InvalidTokenError:
        return None


# =============================================================================
# FUNCIONES DE SANITIZACIÓN Y VALIDACIÓN
# =============================================================================

def sanitize_string(value: str | None) -> str | None:
    """
    Sanitiza un string eliminando espacios al inicio y final.
    Si el string está vacío o solo contiene espacios, retorna None.
    """
    if value is None:
        return None
    if not isinstance(value, str):
        return str(value).strip() if value else None
    cleaned = value.strip()
    return cleaned if cleaned else None


def sanitize_string_upper(value: str | None) -> str | None:
    """
    Sanitiza un string (trim) y lo normaliza a MAYÚSCULAS.
    Si el string está vacío o solo contiene espacios, retorna None.
    """
    cleaned = sanitize_string(value)
    return cleaned.upper() if cleaned else None


def normalize_lote_producto(value: str | None) -> str | None:
    """
    Normaliza el lote del producto:
    - Si está vacío o es None, retorna None (se guardará como "S/L" en el frontend)
    - Elimina espacios sobrantes
    """
    cleaned = sanitize_string(value)
    if not cleaned or cleaned.upper() in ("S/L", "SIN LOTE", ""):
        return None
    return cleaned.upper()


def normalize_fecha(value: str | date | None) -> date | None:
    """
    Normaliza una fecha:
    - Si está vacía, es None o es "S/F", retorna None
    - Si es string vacío, retorna None
    """
    if value is None:
        return None
    if isinstance(value, str):
        cleaned = sanitize_string(value)
        if not cleaned or cleaned.upper() in ("S/F", "SIN FECHA", ""):
            return None
        # Si es un string de fecha válido, intentar parsearlo
        try:
            from datetime import datetime
            return datetime.strptime(cleaned, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return None
    if isinstance(value, date):
        return value
    return None


def sanitize_producto_data(data: dict[str, Any]) -> dict[str, Any]:
    """
    Sanitiza los datos de un producto antes de guardarlos.
    Aplica trim a todos los campos de texto y normaliza fechas/lotes.
    """
    sanitized = {}
    
    # Campos de texto que necesitan trim + MAYÚSCULAS (recepción)
    text_fields = [
        "nombre", "categoria", "elaborado_por", "marca", "presentacion",
        "descripcion", "codigo_interno", "codigo_barras", "motivo_rechazo",
        "uso_recomendado", "condicion", "estado_calidad"
    ]
    
    for field in text_fields:
        if field in data:
            sanitized[field] = sanitize_string_upper(data[field])
    
    # Normalizar lote_producto
    if "lote_producto" in data:
        sanitized["lote_producto"] = normalize_lote_producto(data.get("lote_producto"))
    
    # Normalizar fechas
    if "fecha_elaboracion" in data:
        sanitized["fecha_elaboracion"] = normalize_fecha(data.get("fecha_elaboracion"))
    
    if "fecha_vencimiento" in data:
        sanitized["fecha_vencimiento"] = normalize_fecha(data.get("fecha_vencimiento"))
    
    # Campos numéricos y booleanos se copian tal cual
    numeric_fields = [
        "cantidad_tm", "cantidad_kg", "unidades", "stock_minimo",
        "id_fabricante", "id_lote", "peso_unitario"
    ]
    boolean_fields = ["apto_consumo", "estado"]
    
    for field in numeric_fields + boolean_fields:
        if field in data:
            sanitized[field] = data[field]
    
    # Mantener otros campos que no se sanitizan
    for key, value in data.items():
        if key not in sanitized:
            sanitized[key] = value

    # cantidad_kg / cantidad_tm = peso **por unidad**; mantener coherencia kg ↔ tm
    if "cantidad_kg" in sanitized:
        from app.peso_producto import sincronizar_tm_desde_kg_por_unidad

        sanitized["cantidad_tm"] = sincronizar_tm_desde_kg_por_unidad(
            float(sanitized.get("cantidad_kg") or 0)
        )
    elif "cantidad_tm" in sanitized:
        from app.peso_producto import sincronizar_kg_desde_tm_por_unidad

        sanitized["cantidad_kg"] = sincronizar_kg_desde_tm_por_unidad(
            float(sanitized.get("cantidad_tm") or 0)
        )

    return sanitized


def sanitize_telefono(value: str | None) -> str | None:
    """
    Sanitiza un número de teléfono:
    - Solo permite dígitos numéricos
    - Máximo 11 caracteres
    """
    if not value:
        return None
    if not isinstance(value, str):
        value = str(value)
    # Solo números, máximo 11 caracteres
    cleaned = "".join(filter(str.isdigit, value))[:11]
    return cleaned if cleaned else None


def sanitize_fabricante_data(data: dict[str, Any]) -> dict[str, Any]:
    """Sanitiza los datos de un fabricante."""
    sanitized = {}
    
    text_fields = ["nombre", "rif", "contacto", "email", "direccion"]
    
    for field in text_fields:
        if field in data:
            sanitized[field] = sanitize_string(data[field])
    
    # Teléfono con validación especial (solo números, máximo 11)
    if "telefono" in data:
        sanitized["telefono"] = sanitize_telefono(data["telefono"])
    
    # Campos booleanos
    if "estado" in data:
        sanitized["estado"] = data["estado"]
    
    return sanitized


def sanitize_proveedor_data(data: dict[str, Any]) -> dict[str, Any]:
    """Sanitiza los datos de un proveedor."""
    sanitized = {}
    
    text_fields = ["nombre", "rif", "email", "direccion", "ciudad"]
    
    for field in text_fields:
        if field in data:
            sanitized[field] = sanitize_string(data[field])
    
    # Teléfono con validación especial (solo números, máximo 11)
    if "telefono" in data:
        sanitized["telefono"] = sanitize_telefono(data["telefono"])
    
    # Campos booleanos
    if "estado" in data:
        sanitized["estado"] = data["estado"]
    
    return sanitized


# =============================================================================
# VALIDACIÓN DE RIF
# =============================================================================

def validate_rif_format(rif: str | None) -> bool:
    """
    Valida el formato de RIF venezolano.
    Formato esperado: [V|J|G|E|C|P]-[8 dígitos]-[1 dígito verificador]
    Ejemplo: J-12345678-9
    """
    if not rif:
        return False
    
    import re
    # Patrón: letra inicial (V, J, G, E, C, P), guion, 8 dígitos, guion, 1 dígito
    pattern = r'^[VJGECP]-\d{8}-\d$'
    return bool(re.match(pattern, rif.strip().upper()))


def format_rif(rif: str | None) -> str | None:
    """
    Formatea un RIF asegurándose de que tenga el formato correcto.
    Convierte a mayúsculas y valida el formato.
    """
    if not rif:
        return None
    
    rif_cleaned = sanitize_string(rif)
    if not rif_cleaned:
        return None
    
    # Convertir a mayúsculas
    rif_upper = rif_cleaned.upper()
    
    # Si ya tiene el formato correcto, retornarlo
    if validate_rif_format(rif_upper):
        return rif_upper
    
    # Intentar formatear si tiene el formato pero sin guiones
    import re
    # Si tiene formato sin guiones: J123456789
    match = re.match(r'^([VJGECP])(\d{8})(\d)$', rif_upper)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
    
    return rif_upper
