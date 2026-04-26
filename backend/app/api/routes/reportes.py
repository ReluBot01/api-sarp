import os
import re
from datetime import date, datetime, time
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response
from sqlmodel import select, or_, func

from app.api.deps import CurrentUser, SessionDep
from app.core.config import settings
from app.services.report_service import report_service
from app.models import Proveedor, Lote, LoteProveedorLink, User, Producto


router = APIRouter(prefix="/reportes", tags=["reportes"])


def _normalizar_q_busqueda(q: Optional[str]) -> str:
    """Quita saltos de línea y caracteres invisibles al pegar n.º de guía / lote (p. ej. multilínea desde PDF)."""
    if not q:
        return ""
    t = str(q).strip()
    t = re.sub(r"[\u200b\ufeff]+", "", t)  # zero-width / BOM
    t = re.sub(r"[\r\n\v\f\u2028\u2029]+", "", t)
    # Espacios pegados al copiar entre trozos y guiones (p. ej. "LOT-P35- 20260420")
    t = re.sub(r"-\s+", "-", t)
    t = re.sub(r"\s+-", "-", t)
    t = re.sub(r" +", " ", t)
    return t.strip()


def _parse_optional_bool_query(value: Optional[str]) -> Optional[bool]:
    """Interpreta estado en query (?estado=true|false) sin depender del coercion de FastAPI."""
    if value is None:
        return None
    s = str(value).strip().lower()
    if s in ("", "all", "todos"):
        return None
    if s in ("true", "1", "yes", "on", "activo", "activos"):
        return True
    if s in ("false", "0", "no", "off", "inactivo", "inactivos"):
        return False
    return None


def _guess_logo_path() -> str | None:
    """Busca el logo para PDFs: opción explícia en env, luego `logo.png` (frontend + empaquetado), luego SVG."""
    if settings.REPORTS_LOGO_PATH:
        p = Path(settings.REPORTS_LOGO_PATH).expanduser()
        if not p.is_absolute():
            p = Path.cwd() / p
        p = p.resolve()
        if p.is_file():
            return str(p)

    # __file__ = .../backend/app/api/routes/reportes.py → 4× dirname = carpeta `backend/`
    _backend_dir = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    )
    _app_dir = os.path.dirname(
        os.path.dirname(os.path.dirname(__file__))
    )  # .../backend/app

    candidates = [
        os.path.normpath(
            os.path.join(_backend_dir, "..", "frontend", "public", "assets", "images", "logo.png")
        ),
        os.path.join(_app_dir, "email-templates", "build", "reports", "logo.png"),
        # Respaldo: mismo nombre que en el cliente público (vectorial)
        os.path.normpath(
            os.path.join(
                _backend_dir, "..", "frontend", "public", "assets", "images", "SARP-logo.svg"
            )
        ),
        os.path.join(_app_dir, "email-templates", "build", "reports", "SARP-logo.svg"),
    ]
    for path in candidates:
        try:
            if os.path.isfile(path):
                return path
        except Exception:
            continue
    return None


def _attachment_response(binary: bytes, filename: str, content_type: str) -> Response:
    """Genera una respuesta de descarga con los headers correctos."""
    headers = {
        "Content-Disposition": f"attachment; filename={filename}; filename*=UTF-8''{filename}",
        "Content-Length": str(len(binary)),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
    }
    return Response(content=binary, media_type=content_type, headers=headers)


def _nombre_archivo_productos(formato: str, estado_filtro: Optional[bool]) -> str:
    """Nombre de archivo distinto por filtro para que el cliente vea qué criterio se aplicó."""
    suf = ""
    if estado_filtro is True:
        suf = "-activos"
    elif estado_filtro is False:
        suf = "-inactivos"
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    if formato == "pdf":
        return f"productos{suf}-{stamp}.pdf"
    if formato == "excel":
        return f"productos{suf}-{stamp}.xlsx"
    return f"productos{suf}-{stamp}.bin"


@router.get("/proveedores")
def reporte_proveedores(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    formato: str = Query(default="excel", description="Formato: pdf o excel"),
    q: Optional[str] = Query(default=None, description="Búsqueda por nombre/RIF/email/teléfono"),
    estado: Optional[str] = Query(
        default=None,
        description="true|false: filtrar por Proveedor.estado; omitir = todos",
    ),
    max_registros: int = Query(default=500, ge=1, le=5000),
) -> Any:
    """
    Generar reporte de proveedores en PDF o Excel.
    """
    estado_filtro = _parse_optional_bool_query(estado)
    stmt = select(Proveedor)
    
    filters = []
    if q:
        like = f"%{q}%"
        filters.append(
            or_(
                Proveedor.nombre.ilike(like),
                Proveedor.rif.ilike(like),
                Proveedor.email.ilike(like),
                Proveedor.telefono.ilike(like),
            )
        )
    if estado_filtro is not None:
        filters.append(Proveedor.estado == estado_filtro)
    
    if filters:
        stmt = stmt.where(*filters)
    
    stmt = stmt.order_by(Proveedor.nombre).limit(max_registros)
    proveedores = session.exec(stmt).all()
    
    columns = ["Nombre", "RIF", "Teléfono", "Email", "Dirección", "Ciudad", "Estado"]
    rows = []
    for p in proveedores:
        rows.append([
            p.nombre,
            p.rif,
            p.telefono,
            p.email,
            p.direccion,
            p.ciudad,
            "Activo" if p.estado else "Inactivo"
        ])
    
    filters_meta = {
        "busqueda": q,
        "estado": None
        if estado_filtro is None
        else ("activo" if estado_filtro else "inactivo"),
        "max_registros": max_registros,
    }
    
    if formato == "pdf":
        binary = report_service.render_pdf_table(
            title="Reporte de Proveedores",
            filters=filters_meta,
            columns=columns,
            rows=rows,
            accent_hex="#2D3748",
            logo_path=_guess_logo_path(),
        )
        return _attachment_response(binary, "proveedores.pdf", "application/pdf")
    
    if formato == "excel":
        binary = report_service.render_excel_xlsx(
            sheet="Proveedores",
            headers=columns,
            rows=rows,
        )
        return _attachment_response(
            binary,
            "proveedores.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    
    raise HTTPException(status_code=400, detail="Formato no soportado. Use 'pdf' o 'excel'")


@router.get("/productos")
def reporte_productos(
    request: Request,
    *,
    session: SessionDep,
    current_user: CurrentUser,
    formato: str = Query(default="excel", description="Formato: pdf o excel"),
    q: Optional[str] = Query(
        default=None,
        description="Búsqueda por nombre, código interno, lote del producto (ficha), número de lote de la guía (recepción) o código de barras",
    ),
    categoria: Optional[str] = Query(default=None, description="Filtrar por categoría del producto"),
    desde: Optional[date] = Query(default=None, description="Recepción de la guía: fecha llegada desde"),
    hasta: Optional[date] = Query(default=None, description="Recepción de la guía: fecha llegada hasta"),
    id_lote: Optional[int] = Query(default=None, description="Filtrar por lote"),
    bajo_stock: Optional[bool] = Query(default=None, description="Solo productos con bajo stock"),
    estado: Optional[str] = Query(
        default=None,
        description=(
            "true|false: Activos=en inventario y no retirados; "
            "Inactivos=baja en inventario o retirados del circuito; omitir=todos"
        ),
    ),
    max_registros: int = Query(default=500, ge=1, le=5000),
) -> Any:
    """
    Generar reporte de productos en PDF o Excel.

    Semántica alineada con la pantalla de productos: «retirado» no cambia Producto.estado,
    así que aquí «Activos» excluye retirados; «Inactivos» incluye dados de baja y retirados.
    """
    if desde and hasta and desde > hasta:
        raise HTTPException(status_code=400, detail="Rango de fechas inválido: 'desde' > 'hasta'")

    estado_filtro = _parse_optional_bool_query(estado)
    stmt = select(Producto, Lote.numero_lote).join(Lote, Producto.id_lote == Lote.id_lote)
    if estado_filtro is True:
        stmt = stmt.where(Producto.estado == True, Producto.retirado == False)
    elif estado_filtro is False:
        stmt = stmt.where(or_(Producto.estado == False, Producto.retirado == True))

    if id_lote is not None:
        stmt = stmt.where(Producto.id_lote == id_lote)

    # Leer categoría también desde query string cruda (algunos proxies/clientes no rellenan el Query() igual).
    cat_qp = (request.query_params.get("categoria") or "").strip()
    cat_param = (str(categoria).strip() if categoria else "")
    cat_filtro = cat_qp or cat_param
    if cat_filtro:
        stmt = stmt.where(
            func.lower(func.trim(Producto.categoria)) == cat_filtro.lower()
        )
    
    qn = _normalizar_q_busqueda(q)
    if qn:
        like = f"%{qn}%"
        stmt = stmt.where(
            or_(
                Producto.nombre.ilike(like),
                Producto.codigo_interno.ilike(like),
                Producto.lote_producto.ilike(like),
                Lote.numero_lote.ilike(like),
                Producto.codigo_barras.ilike(like),
            )
        )

    if desde:
        stmt = stmt.where(Lote.fecha_llegada >= datetime.combine(desde, time.min))
    if hasta:
        stmt = stmt.where(Lote.fecha_llegada <= datetime.combine(hasta, time(23, 59, 59)))
    
    if bajo_stock:
        stmt = stmt.where(Producto.unidades <= Producto.stock_minimo)

    stmt = stmt.order_by(Producto.nombre).limit(max_registros)
    resultados = session.exec(stmt).all()

    # Encabezados cortos: guía = lote de recepción; L.fab. = lote del fabricante en ficha del producto
    columns = [
        "Nombre",
        "Marca",
        "Cat.",
        "Present.",
        "Lote",
        "Guía",
        "F/R.",
        "F/E.",
        "F/V.",
        "Uso Rec.",
        "C.Daño",
        "Und.",
        "Kg",
        "TM",
    ]
    rows = []
    for producto, numero_lote_guia in resultados:
        fc = producto.fecha_creacion
        registro_txt = fc.strftime("%Y-%m-%d %H:%M") if fc else "-"
        rows.append(
            [
                producto.nombre or "-",
                producto.marca or "-",
                producto.categoria or "-",
                producto.presentacion or "-",
                producto.lote_producto or "S/L",
                (numero_lote_guia or "").strip() or "-",
                registro_txt,
                producto.fecha_elaboracion if producto.fecha_elaboracion else "S/F",
                producto.fecha_vencimiento if producto.fecha_vencimiento else "S/F",
                producto.uso_recomendado or "-",
                producto.condicion or "-",
                producto.unidades,
                producto.cantidad_kg,
                producto.cantidad_tm,
            ]
        )

    filters_meta = {
        "busqueda": qn or None,
        "categoria": cat_filtro or None,
        "recepcion_desde": str(desde) if desde else None,
        "recepcion_hasta": str(hasta) if hasta else None,
        "id_lote": id_lote,
        "bajo_stock": bajo_stock,
        "estado_producto": None
        if estado_filtro is None
        else ("activos (no retirados)" if estado_filtro else "inactivos o retirados"),
        "max_registros": max_registros,
    }
    
    if formato == "pdf":
        binary = report_service.render_pdf_table(
            title="Reporte de Productos",
            filters=filters_meta,
            columns=columns,
            rows=rows,
            accent_hex="#0EA5A2",
            logo_path=_guess_logo_path(),
            landscape_mode=True,
        )
        return _attachment_response(
            binary,
            _nombre_archivo_productos("pdf", estado_filtro),
            "application/pdf",
        )
    
    if formato == "excel":
        binary = report_service.render_excel_xlsx(
            sheet="Productos",
            headers=columns,
            rows=rows,
            date_columns=[7, 8],  # F.Elab., F.Venc. (índices 0-based)
        )
        return _attachment_response(
            binary,
            _nombre_archivo_productos("excel", estado_filtro),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    
    raise HTTPException(status_code=400, detail="Formato no soportado. Use 'pdf' o 'excel'")


@router.get("/lotes")
def reporte_lotes(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    formato: str = Query(default="excel", description="Formato: pdf o excel"),
    desde: Optional[date] = Query(default=None, description="Fecha de llegada desde"),
    hasta: Optional[date] = Query(default=None, description="Fecha de llegada hasta"),
    id_proveedor: Optional[int] = Query(default=None, description="Filtrar por proveedor"),
    estado_calidad: Optional[str] = Query(default=None, description="Filtrar por estado de calidad (calculado por productos)"),
    max_registros: int = Query(default=500, ge=1, le=5000),
) -> Any:
    """
    Generar reporte de lotes en PDF o Excel.
    """
    if desde and hasta and desde > hasta:
        raise HTTPException(status_code=400, detail="Rango de fechas inválido: 'desde' > 'hasta'")
    
    stmt = (
        select(
            Lote,
            Proveedor.nombre.label("proveedor_nombre"),
            User.full_name.label("usuario_nombre")
        )
        .outerjoin(Proveedor, Proveedor.id_proveedor == Lote.id_proveedor)
        .outerjoin(User, User.id == Lote.id_usuario_recepcion)
    )
    
    filters = []
    if desde:
        filters.append(Lote.fecha_llegada >= datetime.combine(desde, time.min))
    if hasta:
        filters.append(Lote.fecha_llegada <= datetime.combine(hasta, time(23, 59, 59)))
    if id_proveedor:
        lp_match = select(LoteProveedorLink.id_lote).where(
            LoteProveedorLink.id_proveedor == id_proveedor
        )
        filters.append(or_(Lote.id_proveedor == id_proveedor, Lote.id_lote.in_(lp_match)))
    # Nota: estado_calidad ya no existe en Lote; se calcula por productos más abajo.
    
    if filters:
        stmt = stmt.where(*filters)
    
    stmt = stmt.order_by(Lote.fecha_llegada.desc()).limit(max_registros)
    results = session.exec(stmt).all()
    
    # Obtener conteo de productos por lote y calcular estado de calidad/apto consumo por lote
    lote_ids = [r[0].id_lote for r in results]
    productos_count: dict[int, int] = {}
    productos_por_lote: dict[int, list[Producto]] = {}
    if lote_ids:
        prod_stmt = (
            select(Producto.id_lote, func.count(Producto.id_producto))
            .where(Producto.id_lote.in_(lote_ids))
            .group_by(Producto.id_lote)
        )
        for lid, cnt in session.exec(prod_stmt).all():
            productos_count[lid] = cnt
        productos_all = session.exec(select(Producto).where(Producto.id_lote.in_(lote_ids))).all()
        for p in productos_all:
            productos_por_lote.setdefault(p.id_lote, []).append(p)

    # Misma lógica que el API de lotes (tabla puente + orden); import perezoso evita ciclos al cargar routers.
    from app.api.routes.lotes import _proveedores_por_lotes

    lote_ids_int = [int(x) for x in lote_ids if x is not None]
    prov_por_lote = _proveedores_por_lotes(session, lote_ids_int) if lote_ids_int else {}

    def _calcular_estado_calidad(productos: list[Producto]) -> str:
        if not productos:
            return "Pendiente"
        hay_rechazo = any(
            (p.estado_calidad or "").strip().upper() == "RECHAZADO" or (p.apto_consumo is False)
            for p in productos
        )
        if hay_rechazo:
            return "Rechazado"
        todos_aprobados = all(
            (p.estado_calidad or "").strip().upper() == "APROBADO" and (p.apto_consumo is True)
            for p in productos
        )
        return "Aprobado" if todos_aprobados else "Pendiente"

    def _calcular_apto_consumo(productos: list[Producto]) -> str:
        if not productos:
            return "Pendiente"
        return "Sí" if all(p.apto_consumo is True for p in productos) else "No"
    
    columns = [
        "Número Lote",
        "Proveedores",
        "Fecha Llegada",
        "Estado",
        "Estado Calidad",
        "Apto Consumo",
        "Peso Total",
        "Unidad",
        "Productos",
        "Recepcionado Por",
    ]
    rows = []
    for r in results:
        lote = r[0]
        productos_lote = productos_por_lote.get(lote.id_lote, [])
        estado_calidad_calc = _calcular_estado_calidad(productos_lote)
        apto_consumo_calc = _calcular_apto_consumo(productos_lote)
        if estado_calidad and estado_calidad_calc.lower() != estado_calidad.lower():
            continue
        lid_key = int(lote.id_lote) if lote.id_lote is not None else -1
        plist = prov_por_lote.get(lid_key, [])
        proveedores_celda = (
            " · ".join(((p.nombre or "").strip() or "-") for p in plist)
            if plist
            else (r[1] or "-")
        )
        rows.append([
            lote.numero_lote,
            proveedores_celda,
            lote.fecha_llegada,
            lote.estado,
            estado_calidad_calc,
            apto_consumo_calc,
            lote.peso_total_recibido,
            lote.unidad_peso,
            productos_count.get(lote.id_lote, 0),
            r[2] or "-",  # usuario_nombre
        ])
    
    filters_meta = {
        "desde": desde.isoformat() if desde else None,
        "hasta": hasta.isoformat() if hasta else None,
        "id_proveedor": id_proveedor,
        "estado_calidad": estado_calidad,
        "max_registros": max_registros,
    }
    
    if formato == "pdf":
        # Más ancho en "Proveedores" para varios nombres en una guía (el resto se reparte).
        col_fracs = (0.11, 0.22, 0.12, 0.07, 0.11, 0.09, 0.08, 0.05, 0.07, 0.08)
        binary = report_service.render_pdf_table(
            title="Reporte de Lotes",
            filters=filters_meta,
            columns=columns,
            rows=rows,
            accent_hex="#0EA5A2",
            logo_path=_guess_logo_path(),
            landscape_mode=True,
            col_widths_fraction=col_fracs,
        )
        return _attachment_response(binary, "lotes.pdf", "application/pdf")
    
    if formato == "excel":
        binary = report_service.render_excel_xlsx(
            sheet="Lotes",
            headers=columns,
            rows=rows,
            datetime_columns=[2],  # Fecha Llegada
        )
        return _attachment_response(
            binary,
            "lotes.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    
    raise HTTPException(status_code=400, detail="Formato no soportado. Use 'pdf' o 'excel'")
