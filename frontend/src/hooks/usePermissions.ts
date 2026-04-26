import { useQueryClient } from "@tanstack/react-query"
import type { UserPublic } from "@/client"

/**
 * Hook simplificado para manejar permisos de usuario.
 * En el sistema de almacén único, solo hay un usuario administrador.
 */
export const usePermissions = () => {
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])

  /**
   * Verifica si el usuario actual es administrador (superusuario)
   */
  const isAdmin = (): boolean => {
    if (!currentUser) return false
    return currentUser.is_superuser === true
  }

  /**
   * Verifica si el usuario tiene permisos de superusuario
   */
  const isSuperUser = (): boolean => {
    return currentUser?.is_superuser === true
  }

  /**
   * Verifica si el usuario puede acceder a un módulo específico
   */
  const canAccessModule = (module: string): boolean => {
    if (!currentUser) return false
    // En el sistema simplificado, el usuario tiene acceso a todo
    return true
  }

  /**
   * Obtiene el nombre del rol del usuario actual
   */
  const getCurrentUserRoleName = (): string => {
    if (!currentUser) return "Sin sesión"
    if (currentUser.is_superuser) return "Administrador"
    return "Usuario"
  }

  return {
    currentUser,
    isAdmin,
    canAccessModule,
    getCurrentUserRoleName,
    isSuperUser,
  }
}
