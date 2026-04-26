import type { ApiError } from "./client"
import { showApiErrorToast } from "./apiErrorToast"

export const emailPattern = {
  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
  message: "Correo inválido",
}

export const namePattern = {
  value: /^[A-Za-z\s\u00C0-\u017F]{1,30}$/,
  message: "Nombre inválido",
}

export const passwordRules = (isRequired = true) => {
  const rules: any = {
    minLength: {
      value: 8,
      message: "La contraseña debe tener al menos 8 caracteres",
    },
  }

  if (isRequired) {
    rules.required = "La contraseña es obligatoria"
  }

  return rules
}

export const confirmPasswordRules = (
  getValues: () => any,
  isRequired = true,
) => {
  const rules: any = {
    validate: (value: string) => {
      const password = getValues().password || getValues().new_password
      return value === password ? true : "Las contraseñas no coinciden"
    },
  }

  if (isRequired) {
    rules.required = "La confirmación de la contraseña es obligatoria"
  }

  return rules
}

/** Errores API con toast según código HTTP (sin hooks; seguro en callbacks). */
export const handleError = (err: ApiError) => {
  showApiErrorToast(err, "default")
}

// =============================================================================
// FUNCIONES DE SANITIZACIÓN Y VALIDACIÓN
// =============================================================================

/**
 * Sanitiza un string eliminando espacios al inicio y final.
 * Si el string está vacío o solo contiene espacios, retorna null.
 */
export const sanitizeString = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") return String(value).trim() || null
  const cleaned = value.trim()
  return cleaned || null
}

/**
 * Sanitiza un string (trim) y lo normaliza a MAYÚSCULAS.
 * Si el string está vacío o solo contiene espacios, retorna null.
 */
export const sanitizeUpperString = (value: string | null | undefined): string | null => {
  const cleaned = sanitizeString(value)
  return cleaned ? cleaned.toUpperCase() : null
}

/**
 * Normaliza el lote del producto:
 * - Si está vacío, retorna null (se mostrará como "S/L" en el frontend)
 * - Elimina espacios sobrantes
 */
export const normalizeLoteProducto = (value: string | null | undefined): string | null => {
  const cleaned = sanitizeString(value)
  if (!cleaned || cleaned.toUpperCase() === "S/L" || cleaned.toUpperCase() === "SIN LOTE") {
    return null
  }
  return cleaned.toUpperCase()
}

/**
 * Normaliza una fecha:
 * - Si está vacía o es "S/F", retorna null
 * - Si es string vacío, retorna null
 */
export const normalizeFecha = (value: string | null | undefined): string | null => {
  const cleaned = sanitizeString(value)
  if (!cleaned || cleaned.toUpperCase() === "S/F" || cleaned.toUpperCase() === "SIN FECHA") {
    return null
  }
  return cleaned
}

/**
 * Sanitiza los datos de un producto antes de enviarlos al backend.
 */
export const sanitizeProductoData = (data: any): any => {
  const sanitized: any = { ...data }

  // Campos de texto que necesitan trim
  const textFields = [
    "nombre", "categoria", "elaborado_por", "marca", "presentacion",
    "descripcion", "codigo_interno", "codigo_barras", "motivo_rechazo",
    "uso_recomendado", "condicion", "estado_calidad"
  ]

  textFields.forEach(field => {
    if (field in sanitized) {
      // Para recepción: normalizamos a MAYÚSCULAS para evitar inconsistencias
      sanitized[field] = sanitizeUpperString(sanitized[field])
    }
  })

  // Normalizar lote_producto
  if ("lote_producto" in sanitized) {
    sanitized.lote_producto = normalizeLoteProducto(sanitized.lote_producto)
  }

  // Normalizar fechas
  if ("fecha_elaboracion" in sanitized) {
    sanitized.fecha_elaboracion = normalizeFecha(sanitized.fecha_elaboracion)
  }

  if ("fecha_vencimiento" in sanitized) {
    sanitized.fecha_vencimiento = normalizeFecha(sanitized.fecha_vencimiento)
  }

  return sanitized
}

/**
 * Sanitiza los datos de un fabricante antes de enviarlos al backend.
 */
export const sanitizeFabricanteData = (data: any): any => {
  const sanitized: any = { ...data }

  const textFields = ["nombre", "rif", "contacto", "telefono", "email", "direccion"]
  textFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = sanitizeString(sanitized[field])
    }
  })

  return sanitized
}

/**
 * Sanitiza los datos de un proveedor antes de enviarlos al backend.
 */
export const sanitizeProveedorData = (data: any): any => {
  const sanitized: any = { ...data }

  const textFields = ["nombre", "rif", "telefono", "email", "direccion", "ciudad"]
  textFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = sanitizeString(sanitized[field])
    }
  })

  return sanitized
}
