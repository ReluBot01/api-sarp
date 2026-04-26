"""
Peso de línea y de lote: cantidad_kg y cantidad_tm son **por unidad física**.
Peso de línea (kg) = cantidad_kg × unidades (mismo criterio que la recepción en frontend).
"""


def peso_linea_kg(cantidad_kg: float | None, unidades: int | None) -> float:
    kg = float(cantidad_kg or 0)
    u = int(unidades or 0)
    if u <= 0:
        return 0.0
    return round(kg * u, 6)


def peso_total_lote_kg_desde_productos(
    productos: list[object],
) -> float:
    total = 0.0
    for p in productos:
        kg = float(getattr(p, "cantidad_kg", None) or 0)
        u = int(getattr(p, "unidades", None) or 0)
        total += peso_linea_kg(kg, u)
    return round(total, 6)


def sincronizar_tm_desde_kg_por_unidad(cantidad_kg: float | None) -> float:
    return round(float(cantidad_kg or 0) / 1000.0, 6)


def sincronizar_kg_desde_tm_por_unidad(cantidad_tm: float | None) -> float:
    return round(float(cantidad_tm or 0) * 1000.0, 6)
