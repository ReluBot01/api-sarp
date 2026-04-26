import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { OpenAPI } from "@/client"
import { request as apiRequest } from "@/client/core/request"
import useCustomToast from "./useCustomToast"
import { handleError } from "@/utils"

export type ProductoFilters = {
  skip?: number
  limit?: number
  q?: string
  id_lote?: number
  bajo_stock?: boolean
}

export const getProductosQueryKey = (params: ProductoFilters = {}) => ["productos", params]

export default function useProductos(params: ProductoFilters = {}) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { skip = 0, limit = 50, q, id_lote, bajo_stock } = params

  // Query para obtener productos
  const productosQuery = useQuery({
    queryKey: getProductosQueryKey({ skip, limit, q, id_lote, bajo_stock }),
    queryFn: async () => {
      return await apiRequest(OpenAPI, {
        method: "GET",
        url: "/api/v1/productos/",
        query: { 
          skip, 
          limit, 
          q: q || undefined,
          id_lote: id_lote || undefined,
          bajo_stock: bajo_stock || undefined,
        },
      })
    },
  })

  // Query para obtener estadísticas
  const statsQuery = useQuery({
    queryKey: ["productos", "stats"],
    queryFn: async () => {
      return await apiRequest(OpenAPI, {
        method: "GET",
        url: "/api/v1/productos/stats",
      })
    },
  })

  // Mutation para ajustar stock
  const ajustarStockMutation = useMutation({
    mutationFn: ({ id, cantidad, motivo }: { id: number; cantidad: number; motivo?: string }) =>
      apiRequest(OpenAPI, {
        method: "PATCH",
        url: `/api/v1/productos/${id}/ajustar-stock`,
        query: { cantidad, motivo },
      }),
    onSuccess: () => {
      showSuccessToast("Stock ajustado exitosamente")
      queryClient.invalidateQueries({ queryKey: ["productos"] })
    },
    onError: (error: any) => {
      showErrorToast(error?.body?.detail || "Error al ajustar el stock")
      handleError(error)
    },
  })

  // Mutation para actualizar producto
  const updateProductoMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest(OpenAPI, {
        method: "PUT",
        url: `/api/v1/productos/${id}`,
        body: data,
        mediaType: "application/json",
      }),
    onSuccess: () => {
      showSuccessToast("Producto actualizado exitosamente")
      queryClient.invalidateQueries({ queryKey: ["productos"] })
    },
    onError: handleError,
  })

  return {
    ...productosQuery,
    data: productosQuery.data,
    isLoading: productosQuery.isLoading,
    statsQuery,
    ajustarStockMutation,
    updateProductoMutation,
  }
}
