import type { CancelablePromise } from "./core/CancelablePromise"
import { OpenAPI } from "./core/OpenAPI"
import { request as __request } from "./core/request"

export interface FabricanteCreate {
  nombre: string
  rif: string
  contacto?: string | null
  telefono?: string | null
  email?: string | null
  direccion?: string | null
  estado?: boolean
}

export interface FabricanteUpdate {
  nombre?: string
  rif?: string
  contacto?: string | null
  telefono?: string | null
  email?: string | null
  direccion?: string | null
  estado?: boolean
}

export interface FabricantePublic {
  id_fabricante: number
  nombre: string
  rif: string
  contacto?: string | null
  telefono?: string | null
  email?: string | null
  direccion?: string | null
  estado: boolean
  fecha_creacion?: string | null
}

export interface FabricantesPublic {
  data: FabricantePublic[]
  count: number
}

export class FabricantesService {
  public static readFabricantes(data: {
    skip?: number
    limit?: number
    q?: string
    solo_activos?: boolean
  } = {}): CancelablePromise<FabricantesPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/fabricantes/",
      query: {
        skip: data.skip,
        limit: data.limit,
        q: data.q,
        solo_activos: data.solo_activos,
      },
    })
  }

  public static readFabricantesActivos(data: {
    q?: string
  } = {}): CancelablePromise<FabricantesPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/fabricantes/activos",
      query: {
        q: data.q,
      },
    })
  }

  public static readFabricante(data: { id: number }): CancelablePromise<FabricantePublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: `/api/v1/fabricantes/${data.id}`,
    })
  }

  public static createFabricante(data: {
    requestBody: FabricanteCreate
  }): CancelablePromise<FabricantePublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/fabricantes/",
      body: data.requestBody,
      mediaType: "application/json",
    })
  }

  public static updateFabricante(data: {
    id: number
    requestBody: FabricanteUpdate
  }): CancelablePromise<FabricantePublic> {
    return __request(OpenAPI, {
      method: "PUT",
      url: `/api/v1/fabricantes/${data.id}`,
      body: data.requestBody,
      mediaType: "application/json",
    })
  }

  public static toggleEstado(data: { id: number }): CancelablePromise<{ message: string; estado: boolean }> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: `/api/v1/fabricantes/${data.id}/toggle-estado`,
    })
  }

  public static deleteFabricante(data: { id: number }): CancelablePromise<{ message: string }> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: `/api/v1/fabricantes/${data.id}`,
    })
  }

  public static forceDeleteFabricante(data: { id: number }): CancelablePromise<{ message: string }> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: `/api/v1/fabricantes/${data.id}/force`,
    })
  }
}
