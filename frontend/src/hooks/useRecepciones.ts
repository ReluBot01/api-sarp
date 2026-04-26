import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { OpenAPI } from "@/client"
import { request as apiRequest } from "@/client/core/request"
import useCustomToast from "./useCustomToast"
import { handleError } from "@/utils"

// Categorías de productos disponibles
export const CATEGORIAS_PRODUCTO = [
  "Fruta, verduras y hortalizas",
  "Granos",
  "Cereales",
  "Proteínas",
  "Embutidos",
  "Enlatados",
  "Lácteos",
  "Grasas",
  "Salsas",
  "Azúcares",
  "Bebidas",
  "Confitería",
  "Productos de higiene personal",
  "Productos de limpieza",
  "Condimentos",
  "Hogar",
  "Otros",
]

// Usos recomendados
export const USOS_RECOMENDADOS = [
  "PC DIRECTO HUMANO (PCDH)",
  "PC INDIRECTO",
  "USO INDUSTRIAL",
  "USO AGRÍCOLA",
  "USO VETERINARIO",
  "OTRO"
]

// Condiciones del producto
export const CONDICIONES_PRODUCTO = [
  "OPTIMAS CONDICIONES",
  "DAÑADO",
  "VENCIDO",
  "NO APTO"
]

const CONDICIONES_RECEPCION_PERMITIDAS = new Set(CONDICIONES_PRODUCTO)

const normalizarCondicionRecepcion = (condicion: string): string => {
  if (condicion === "DAÑADO PARCIALMENTE" || condicion === "DAÑADO TOTALMENTE") {
    return "DAÑADO"
  }
  return condicion
}

export type ProductoItem = {
  // Información básica
  nombre: string
  categoria: string
  descripcion?: string | null
  // Fabricante
  id_fabricante?: number | null
  elaborado_por?: string | null
  // Marca y presentación
  marca?: string | null
  presentacion?: string | null
  // Lote del producto
  lote_producto?: string | null
  // Fechas
  fecha_elaboracion?: string | null
  fecha_vencimiento?: string | null
  // Uso y condición
  uso_recomendado: string
  condicion: string
  // Cantidades
  cantidad_tm: number
  cantidad_kg: number
  unidades: number
  peso_unitario?: number
  // Control de calidad
  estado_calidad: string
  apto_consumo: boolean
  motivo_rechazo?: string | null
  // Stock
  stock_minimo?: number
  // Códigos opcionales
  codigo_interno?: string | null
  codigo_barras?: string | null
}

export type LoteCreate = {
  numero_lote?: string | null
  /** Compatibilidad: si solo hay uno, puede enviarse solo este campo */
  id_proveedor?: number | null
  /** Lista ordenada; el primero es el proveedor principal de la guía */
  id_proveedores?: number[]
  peso_total_recibido?: number
  unidad_peso?: string
  observaciones?: string | null
}

export type RecepcionLotePayload = {
  lote: LoteCreate
  productos: ProductoItem[]
}

export type LoteFilters = {
  q?: string | null
  estado?: string | null
  id_proveedor?: number | null
  fecha_desde?: string | null
  fecha_hasta?: string | null
}

export type Catalogos = {
  categorias: string[]
  usos_recomendados: string[]
  condiciones: string[]
}

export const useRecepciones = (filters?: LoteFilters) => {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  // Query para obtener lotes con filtros
  const lotesQuery = useQuery({
    queryKey: ["lotes", filters],
    queryFn: () =>
      apiRequest(OpenAPI, {
        method: "GET",
        url: "/api/v1/lotes/",
        query: {
          skip: 0,
          limit: 100,
          q: filters?.q || undefined,
          estado: filters?.estado || undefined,
          id_proveedor: filters?.id_proveedor || undefined,
          fecha_desde: filters?.fecha_desde || undefined,
          fecha_hasta: filters?.fecha_hasta || undefined,
        },
      }),
  })

  // Query para obtener estadísticas de lotes
  const statsQuery = useQuery({
    queryKey: ["lotes", "stats"],
    queryFn: () =>
      apiRequest(OpenAPI, {
        method: "GET",
        url: "/api/v1/lotes/stats",
      }),
  })

  // Query para obtener productos próximos a vencer
  const alertasQuery = useQuery({
    queryKey: ["productos", "alertas"],
    queryFn: () =>
      apiRequest(OpenAPI, {
        method: "GET",
        url: "/api/v1/lotes/proximos-vencer",
      }),
  })

  // Catálogos de usos y condiciones (categorías van siempre de CATEGORIAS_PRODUCTO en cliente)
  const catalogosQuery = useQuery<Catalogos>({
    queryKey: ["catalogos"],
    queryFn: () =>
      apiRequest(OpenAPI, {
        method: "GET",
        url: "/api/v1/lotes/catalogos",
      }),
    staleTime: Infinity,
  })

  // Mutation para crear una nueva recepción
  const recepcionMutation = useMutation({
    mutationFn: (data: RecepcionLotePayload) =>
      apiRequest(OpenAPI, {
        method: "POST",
        url: "/api/v1/lotes/recepcion",
        body: {
          lote: data.lote,
          productos: data.productos,
        },
        mediaType: "application/json",
      }),
    onSuccess: () => {
      showSuccessToast("Guia recepcionada exitosamente")
      queryClient.invalidateQueries({ queryKey: ["lotes"] })
      queryClient.invalidateQueries({ queryKey: ["productos"] })
    },
    onError: (error: any) => {
      showErrorToast(error?.body?.detail || "Error al registrar la recepción")
      handleError(error)
    },
  })

  // Mutation para actualizar un lote
  const updateLoteMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<LoteCreate> }) =>
      apiRequest(OpenAPI, {
        method: "PUT",
        url: `/api/v1/lotes/${id}`,
        body: data,
        mediaType: "application/json",
      }),
    onSuccess: () => {
      showSuccessToast("Guia actualizada exitosamente")
      queryClient.invalidateQueries({ queryKey: ["lotes"] })
    },
    onError: handleError,
  })

  return {
    lotesQuery,
    statsQuery,
    alertasQuery,
    catalogosQuery,
    recepcionMutation,
    updateLoteMutation,
    // Categorías: solo la lista definida aquí (evita caché antigua de /catalogos y desincronía con API)
    categorias: CATEGORIAS_PRODUCTO,
    usosRecomendados: catalogosQuery.data?.usos_recomendados || USOS_RECOMENDADOS,
    condiciones: Array.from(
      new Set(
        (catalogosQuery.data?.condiciones || CONDICIONES_PRODUCTO)
          .map(normalizarCondicionRecepcion)
          .filter((condicion) => CONDICIONES_RECEPCION_PERMITIDAS.has(condicion))
      )
    ),
  }
}

export default useRecepciones
