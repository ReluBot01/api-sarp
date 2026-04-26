import type { CancelablePromise } from "./core/CancelablePromise"
import { OpenAPI } from "./core/OpenAPI"
import { request as __request } from "./core/request"
import type { ProductoPublic } from "./ProductosService"

export interface ProveedorEnLotePublic {
  id_proveedor: number
  nombre?: string | null
  orden: number
}

export interface LoteCreate {
  numero_lote?: string | null
  id_proveedor?: number | null
  id_proveedores?: number[]
  peso_total_recibido?: number
  unidad_peso?: string
  observaciones?: string | null
}

export interface LoteUpdate {
  numero_lote?: string
  id_proveedor?: number
  estado?: string
  peso_total_recibido?: number
  unidad_peso?: string
  observaciones?: string | null
}

export interface LoteEdicionRegistroPublic {
  id_auditoria: number
  id_usuario: string
  usuario_nombre?: string | null
  fecha_modificacion: string
  resumen: string
  detalle: Record<string, unknown>
}

export interface LotePublic {
  id_lote: number
  numero_lote: string
  fecha_llegada: string
  fecha_registro: string
  estado: string
  peso_total_recibido: number
  unidad_peso: string
  observaciones?: string | null
  id_proveedor: number
  id_usuario_recepcion?: string | null
  edicion_realizada?: boolean
  proveedor_nombre?: string | null
  proveedores?: ProveedorEnLotePublic[]
  usuario_recepcion_nombre?: string | null
  total_productos?: number | null
  stock_total?: number | null
  estado_calidad?: string | null
}

export interface LotesPublic {
  data: LotePublic[]
  count: number
}

export interface LotePublicExtended extends LotePublic {
  productos: ProductoPublic[]
  registro_edicion?: LoteEdicionRegistroPublic | null
}

/** Ítem de producto para edición única (mismos campos que actualización + id_producto) */
export interface ProductoEdicionUnicaItem {
  id_producto: number
  nombre?: string
  categoria?: string
  id_fabricante?: number | null
  elaborado_por?: string | null
  marca?: string | null
  presentacion?: string | null
  lote_producto?: string | null
  fecha_elaboracion?: string | null
  fecha_vencimiento?: string | null
  uso_recomendado?: string
  condicion?: string
  cantidad_tm?: number
  cantidad_kg?: number
  unidades?: number
  estado_calidad?: string
  apto_consumo?: boolean
  motivo_rechazo?: string | null
  stock_minimo?: number
  descripcion?: string | null
  codigo_interno?: string | null
  codigo_barras?: string | null
  estado?: boolean
}

export interface LoteEdicionUnicaRequest {
  numero_lote: string
  id_proveedor?: number | null
  id_proveedores?: number[]
  productos: ProductoEdicionUnicaItem[]
}

export interface LotesStats {
  total_lotes: number
  activos: number
  cerrados: number
  peso_total_almacen: number
  unidad_peso: string
}

export interface ProductoLoteCreate {
  // Información básica
  nombre: string
  categoria?: string
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
  uso_recomendado?: string
  condicion?: string
  // Cantidades
  cantidad_tm?: number
  cantidad_kg?: number
  unidades?: number
  peso_unitario?: number
  // Control de calidad
  estado_calidad?: string
  apto_consumo?: boolean
  motivo_rechazo?: string | null
  // Stock
  stock_minimo?: number
  // Códigos opcionales
  codigo_interno?: string | null
  codigo_barras?: string | null
}

export interface RecepcionLotePayload {
  lote: LoteCreate
  productos: ProductoLoteCreate[]
}

export interface RecepcionResponse {
  message: string
  lote: LotePublic
  productos_ids: number[]
}

export interface LoteReciente {
  id_lote: number
  numero_lote: string
  fecha_llegada: string
  proveedor_nombre?: string | null
  total_productos: number
}

export interface AlertaVencimiento {
  id_producto: number
  nombre: string
  categoria: string
  fecha_vencimiento?: string | null
  dias_restantes: number
  unidades: number
  numero_lote?: string | null
  proveedor_nombre?: string | null
  prioridad: string
}

export interface AlertasVencimientoPublic {
  data: AlertaVencimiento[]
  count: number
  dias_configurados: number
}

export interface CategoriasPublic {
  categorias: string[]
}

export interface CatalogosPublic {
  categorias: string[]
  usos_recomendados: string[]
  condiciones: string[]
}

export class LotesService {
  public static getCategorias(): CancelablePromise<CategoriasPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/lotes/categorias",
    })
  }

  public static getCatalogos(): CancelablePromise<CatalogosPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/lotes/catalogos",
    })
  }

  public static readLotes(data: {
    skip?: number
    limit?: number
    q?: string
    estado?: string
    id_proveedor?: number
    fecha_desde?: string
    fecha_hasta?: string
  } = {}): CancelablePromise<LotesPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/lotes/",
      query: {
        skip: data.skip,
        limit: data.limit,
        q: data.q,
        estado: data.estado,
        id_proveedor: data.id_proveedor,
        fecha_desde: data.fecha_desde,
        fecha_hasta: data.fecha_hasta,
      },
    })
  }

  public static readLote(data: { id: number }): CancelablePromise<LotePublicExtended> {
    return __request(OpenAPI, {
      method: "GET",
      url: `/api/v1/lotes/${data.id}`,
    })
  }

  public static getLotesStats(): CancelablePromise<LotesStats> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/lotes/stats",
    })
  }

  public static getLotesRecientes(data: {
    limit?: number
  } = {}): CancelablePromise<LoteReciente[]> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/lotes/recientes",
      query: {
        limit: data.limit,
      },
    })
  }

  public static getProductosProximosVencer(data: {
    dias?: number
  } = {}): CancelablePromise<AlertasVencimientoPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/lotes/proximos-vencer",
      query: {
        dias: data.dias,
      },
    })
  }

  public static recepcionLote(data: {
    lote: LoteCreate
    productos: ProductoLoteCreate[]
  }): CancelablePromise<RecepcionResponse> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/lotes/recepcion",
      body: {
        lote: data.lote,
        productos: data.productos,
      },
      mediaType: "application/json",
    })
  }

  public static updateLote(data: {
    id: number
    requestBody: LoteUpdate
  }): CancelablePromise<LotePublic> {
    return __request(OpenAPI, {
      method: "PUT",
      url: `/api/v1/lotes/${data.id}`,
      body: data.requestBody,
      mediaType: "application/json",
    })
  }

  public static edicionUnicaLote(data: {
    id: number
    requestBody: LoteEdicionUnicaRequest
  }): CancelablePromise<LotePublicExtended> {
    return __request(OpenAPI, {
      method: "PUT",
      url: `/api/v1/lotes/${data.id}/edicion-unica`,
      body: data.requestBody,
      mediaType: "application/json",
    })
  }

  public static deleteLote(data: { id: number }): CancelablePromise<{ message: string }> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: `/api/v1/lotes/${data.id}`,
    })
  }

  public static forceDeleteLote(data: { id: number }): CancelablePromise<{ message: string }> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: `/api/v1/lotes/${data.id}/force`,
    })
  }
}
