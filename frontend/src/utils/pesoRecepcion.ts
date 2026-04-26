/**
 * `cantidad_kg` y `cantidad_tm` en producto = valores **por unidad física**.
 * Peso de línea (kg) = kg/unidad × unidades.
 */
export function pesoLineaKg(
  cantidadKg: number | null | undefined,
  unidades: number | null | undefined,
): number {
  const kg = Number(cantidadKg ?? 0)
  const u = Math.floor(Number(unidades ?? 0))
  if (u <= 0) return 0
  return Math.round(kg * u * 1e6) / 1e6
}

export function pesoTotalLoteKgDesdeProductos<
  T extends { cantidad_kg?: number; unidades?: number },
>(productos: T[]): number {
  return Math.round(
    productos.reduce((s, p) => s + pesoLineaKg(p.cantidad_kg, p.unidades), 0) * 1e6,
  ) / 1e6
}

export function kgPorUnidadDesdeTm(tm: number): number {
  return Math.round(tm * 1000 * 1e6) / 1e6
}

export function tmPorUnidadDesdeKg(kg: number): number {
  return Math.round((kg / 1000) * 1e6) / 1e6
}

/** Gramos por unidad (solo UI; en BD se persiste como kg/unidad). */
export function gramosPorUnidadDesdeKg(kg: number): number {
  return Math.round(kg * 1000 * 1e6) / 1e6
}

/** kg/unidad a partir de gramos/unidad. */
export function kgPorUnidadDesdeGramos(gr: number): number {
  return Math.round((gr / 1000) * 1e6) / 1e6
}
