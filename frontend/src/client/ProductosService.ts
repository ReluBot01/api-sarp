import type { CancelablePromise } from './core/CancelablePromise'
import { OpenAPI } from './core/OpenAPI'
import { request as __request } from './core/request'

export interface ProductoPublic {
  id_producto: number
  // Información básica
  nombre: string
  categoria: string
  descripcion?: string | null
  // Fabricante
  id_fabricante?: number | null
  elaborado_por?: string | null
  fabricante_nombre?: string | null
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
  // Control de calidad
  estado_calidad: string
  apto_consumo: boolean
  motivo_rechazo?: string | null
  // Stock
  stock_minimo: number
  // Códigos
  codigo_interno?: string | null
  codigo_barras?: string | null
  // Estado
  estado: boolean
  /** Retirado del circuito de alertas de vencimiento (sigue en la guía) */
  retirado?: boolean
  fecha_retiro?: string | null
  id_lote: number
  fecha_creacion: string
  // Campos extendidos
  numero_lote?: string | null
  fecha_llegada?: string | null
  proveedor_nombre?: string | null
}

export interface ProductosPublic {
  data: ProductoPublic[]
  count: number
}

export interface ProductosStats {
  total_productos: number
  stock_total: number
  productos_bajo_stock: number
  productos_sin_stock: number
  productos_por_vencer: number
  productos_vencidos: number
  lotes_activos: number
}

export interface CategoriasPublic {
  categorias: string[]
}

export interface CatalogosPublic {
  categorias: string[]
  usos_recomendados: string[]
  condiciones: string[]
}

export class ProductosService {
  public static getCategorias(): CancelablePromise<CategoriasPublic> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/productos/categorias',
    })
  }

  public static getCatalogos(): CancelablePromise<CatalogosPublic> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/productos/catalogos',
    })
  }

  public static readProductos(data: { 
    skip?: number
    limit?: number
    q?: string
    id_lote?: number
    categoria?: string
    estado_calidad?: string
    apto_consumo?: boolean
    bajo_stock?: boolean
    por_vencer?: boolean
  } = {}): CancelablePromise<ProductosPublic> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/productos/',
      query: {
        skip: data.skip,
        limit: data.limit,
        q: data.q,
        id_lote: data.id_lote,
        categoria: data.categoria,
        estado_calidad: data.estado_calidad,
        apto_consumo: data.apto_consumo,
        bajo_stock: data.bajo_stock,
        por_vencer: data.por_vencer,
      },
    })
  }

  public static readProducto(data: { id: number }): CancelablePromise<ProductoPublic> {
    return __request(OpenAPI, {
      method: 'GET',
      url: `/api/v1/productos/${data.id}`,
    })
  }

  public static readStats(): CancelablePromise<ProductosStats> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/productos/stats',
    })
  }

  /** Vencidos o por vencer (no retirados); para dashboard y retiro rápido. */
  public static readPendientesRetiro(data: { limit?: number } = {}): CancelablePromise<ProductosPublic> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/productos/retiro/pendientes',
      query: {
        limit: data.limit,
      },
    })
  }

  public static actualizarCalidad(data: { 
    id: number
    estado_calidad: string
    apto_consumo: boolean
    condicion?: string | null
    motivo_rechazo?: string | null
  }): CancelablePromise<{ message: string; estado_calidad: string; apto_consumo: boolean; condicion?: string }> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: `/api/v1/productos/${data.id}/calidad`,
      query: {
        estado_calidad: data.estado_calidad,
        apto_consumo: data.apto_consumo,
        condicion: data.condicion,
        motivo_rechazo: data.motivo_rechazo,
      },
    })
  }

  public static ajustarStock(data: { 
    id: number
    unidades: number
    motivo?: string | null
  }): CancelablePromise<{ message: string; unidades_anterior: number; ajuste: number; unidades_nueva: number }> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: `/api/v1/productos/${data.id}/ajustar-stock`,
      query: {
        unidades: data.unidades,
        motivo: data.motivo,
      },
    })
  }

  public static deleteProducto(data: { id: number }): CancelablePromise<{ message: string }> {
    return __request(OpenAPI, {
      method: 'DELETE',
      url: `/api/v1/productos/${data.id}`,
    })
  }

  /** Marca retiro físico: deja de alertar por vencimiento; el producto sigue en la guía. */
  public static retirarProducto(data: { id: number }): CancelablePromise<ProductoPublic> {
    return __request(OpenAPI, {
      method: 'POST',
      url: `/api/v1/productos/${data.id}/retirar`,
    })
  }
}
