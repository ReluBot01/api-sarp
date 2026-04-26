"""Permisos: admin muta edición/cierre/borrado de lotes y catálogos; recepción de lotes para cualquier usuario autenticado."""

from fastapi.testclient import TestClient

from app.core.config import settings


def test_usuario_normal_no_puede_eliminar_lote(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    r = client.delete(
        f"{settings.API_V1_STR}/lotes/1",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403
    assert "administrador" in r.json()["detail"].lower()


def test_usuario_normal_puede_post_recepcion_sin_bloqueo_por_rol(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    """Recepción de lotes: cualquier usuario autenticado (no 403 por permisos)."""
    r = client.post(
        f"{settings.API_V1_STR}/lotes/recepcion",
        headers=normal_user_token_headers,
        json={"lote": {}, "productos": []},
    )
    assert r.status_code != 403


def test_usuario_normal_puede_listar_lotes(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/lotes/",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 200


def test_usuario_normal_puede_descargar_reporte_proveedores_excel(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/reportes/proveedores",
        headers=normal_user_token_headers,
        params={"formato": "excel"},
    )
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith(
        "application/vnd.openxmlformats-officedocument"
    )


def test_usuario_normal_no_puede_actualizar_proveedor(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    r = client.put(
        f"{settings.API_V1_STR}/proveedores/1",
        headers=normal_user_token_headers,
        json={"nombre": "Cambio no permitido"},
    )
    assert r.status_code == 403
