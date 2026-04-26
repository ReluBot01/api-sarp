"use client"

import type { ApiError } from "@/client"
import { toaster } from "@/components/ui/toaster"

export type ApiErrorContext = "default" | "login"

/** Extrae el mensaje `detail` de respuestas FastAPI (string o lista de validación). */
export function getErrorDetail(err: ApiError): string | undefined {
  const detail = (err.body as { detail?: unknown } | undefined)?.detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string }
    if (typeof first?.msg === "string") return first.msg
  }
  return undefined
}

function detailLooksInactive(detail?: string): boolean {
  if (!detail) return false
  const d = detail.toLowerCase()
  return d.includes("inactive") || d.includes("inactivo")
}

/**
 * Muestra un toast según el código HTTP y el contexto (p. ej. login).
 * No usa hooks: puede llamarse desde callbacks de mutaciones.
 */
export function showApiErrorToast(
  err: ApiError,
  context: ApiErrorContext = "default",
): void {
  const status = err.status
  const detail = getErrorDetail(err)

  if (context === "login") {
    if (detailLooksInactive(detail)) {
      toaster.create({
        type: "error",
        title: "Cuenta inactiva",
        description:
          "Tu cuenta está deshabilitada. Contacta al administrador.",
      })
      return
    }
    if (status === 401 || status === 400) {
      toaster.create({
        type: "error",
        title: "No se pudo iniciar sesión",
        description:
          "Credenciales inválidas. Verifica tu correo y contraseña.",
      })
      return
    }
    if (status === 403) {
      toaster.create({
        type: "error",
        title: "Acceso denegado",
        description:
          detail || "No tienes permiso para iniciar sesión en este momento.",
      })
      return
    }
    if (status === 422) {
      toaster.create({
        type: "error",
        title: "Datos inválidos",
        description: detail || "Revisa el correo y la contraseña.",
      })
      return
    }
    if (status >= 500) {
      toaster.create({
        type: "error",
        title: "Error del servidor",
        description: "Intenta de nuevo en unos minutos.",
      })
      return
    }
    toaster.create({
      type: "error",
      title: "Error al iniciar sesión",
      description: detail || "No se pudo completar el inicio de sesión.",
    })
    return
  }

  // Contexto general (resto de la app)
  switch (status) {
    case 400:
      toaster.create({
        type: "error",
        title: "Solicitud incorrecta",
        description: detail || "Revisa los datos enviados.",
      })
      break
    case 401:
      toaster.create({
        type: "error",
        title: "Sesión no válida",
        description: detail || "Inicia sesión de nuevo.",
      })
      break
    case 403:
      toaster.create({
        type: "error",
        title: "Sin permiso",
        description: detail || "No tienes autorización para esta acción.",
      })
      break
    case 404:
      toaster.create({
        type: "error",
        title: "No encontrado",
        description: detail || "El recurso solicitado no existe.",
      })
      break
    case 422:
      toaster.create({
        type: "error",
        title: "Validación",
        description: detail || "Revisa los campos del formulario.",
      })
      break
    case 409:
      toaster.create({
        type: "error",
        title: "Conflicto",
        description: detail || "La operación no se puede aplicar en el estado actual.",
      })
      break
    default:
      if (status >= 500) {
        toaster.create({
          type: "error",
          title: "Error del servidor",
          description: "Intenta de nuevo más tarde.",
        })
      } else {
        toaster.create({
          type: "error",
          title: "Algo salió mal",
          description: detail || `Error ${status}.`,
        })
      }
  }
}
