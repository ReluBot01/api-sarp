import {
  Container,
  EmptyState,
  Flex,
  Box,
  Heading,
  Table,
  VStack,
  SimpleGrid,
  Text,
  Card,
  Icon,
  Badge,
  Input,
  Button,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { FiSearch, FiBox, FiAlertTriangle } from "react-icons/fi"
import { useEffect, useMemo, useState } from "react"
import { z } from "zod"

import { OpenAPI } from "@/client"
import { request as apiRequest } from "@/client/core/request"
import { ProductosService, type ProductoPublic, type ProductosStats } from "@/client/ProductosService"
import { RetirarProductoAction } from "@/components/Productos/RetirarProductoAction"
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination"
import { Select, SelectItem } from "@/components/ui/select"
import PendingItems from "@/components/Pending/PendingItems"
import { CATEGORIAS_PRODUCTO } from "@/hooks/useRecepciones"

const productosSearchSchema = z.object({
  page: z.coerce.number().catch(1),
  q: z.string().catch(""),
  categoria: z.string().catch(""),
  estado_calidad: z.string().catch(""),
  apto: z.string().catch(""),
  bajo_stock: z.string().catch(""),
  por_vencer: z.string().catch(""),
})

export type ProductosSearch = z.infer<typeof productosSearchSchema>

const PER_PAGE = 10

function getDiasParaVencer(fechaVencimiento: string | null | undefined): number | null {
  if (!fechaVencimiento) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const vencimiento = new Date(fechaVencimiento)
  vencimiento.setHours(0, 0, 0, 0)
  return Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

function puedeRetirarProducto(p: ProductoPublic, diasAlerta: number): boolean {
  if (p.retirado || !p.fecha_vencimiento) return false
  const dias = getDiasParaVencer(p.fecha_vencimiento)
  if (dias === null) return false
  if (dias < 0) return true
  return dias <= diasAlerta
}

/** Misma categoría escrita distinto (mayúsculas, espacios) → una sola clave. */
function claveCategoriaNormalizada(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

/** Encaje en el catálogo oficial; si no aplica (p. ej. valor viejo en BD), cadena vacía. */
function valorCategoriaParaSelect(urlCategoria: string, catalogoValido: readonly string[]): string {
  const t = urlCategoria.trim()
  if (!t) return ""
  const k = claveCategoriaNormalizada(t)
  return catalogoValido.find((o) => claveCategoriaNormalizada(o) === k) ?? ""
}

function searchToProductosApi(s: Omit<ProductosSearch, "page">) {
  const apto =
    s.apto === "true" ? true : s.apto === "false" ? false : undefined
  const catRaw = s.categoria.trim()
  const categoria =
    catRaw === ""
      ? undefined
      : valorCategoriaParaSelect(catRaw, CATEGORIAS_PRODUCTO) || undefined
  return {
    q: s.q.trim() || undefined,
    categoria,
    estado_calidad: s.estado_calidad || undefined,
    apto_consumo: apto,
    bajo_stock: s.bajo_stock === "true" ? true : undefined,
    por_vencer: s.por_vencer === "true" ? true : undefined,
  }
}

function getProductosQueryOptions(search: ProductosSearch) {
  const { page, ...rest } = search
  const api = searchToProductosApi(rest)
  return {
    queryFn: () =>
      ProductosService.readProductos({
        ...api,
        skip: (page - 1) * PER_PAGE,
        limit: PER_PAGE,
      }),
    queryKey: ["productos", search] as const,
  }
}

function hasActiveProductosFilters(search: ProductosSearch) {
  const categoriaValida = valorCategoriaParaSelect(search.categoria, CATEGORIAS_PRODUCTO)
  return (
    search.q.trim() !== "" ||
    categoriaValida !== "" ||
    search.estado_calidad !== "" ||
    search.apto !== "" ||
    search.bajo_stock !== "" ||
    search.por_vencer !== ""
  )
}

export const Route = createFileRoute("/_layout/productos")({
  component: Productos,
  validateSearch: (search) => productosSearchSchema.parse(search),
})

function ProductosFiltersBar() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()
  const [searchInput, setSearchInput] = useState(search.q || "")

  const categoriaSelectValue = useMemo(
    () => valorCategoriaParaSelect(search.categoria, CATEGORIAS_PRODUCTO),
    [search.categoria],
  )

  useEffect(() => {
    const raw = search.categoria.trim()
    if (!raw) return
    const canon = valorCategoriaParaSelect(raw, CATEGORIAS_PRODUCTO)
    if (canon === "") {
      navigate({
        to: "/productos",
        search: (prev) => ({ ...prev, categoria: "" }),
        replace: true,
      })
      return
    }
    if (canon !== raw) {
      navigate({
        to: "/productos",
        search: (prev) => ({ ...prev, categoria: canon }),
        replace: true,
      })
    }
  }, [search.categoria, navigate])

  useEffect(() => {
    setSearchInput(search.q || "")
  }, [search.q])

  useEffect(() => {
    const next = searchInput.trim()
    if (next === (search.q || "").trim()) return
    const t = setTimeout(() => {
      navigate({
        to: "/productos",
        search: (prev) => ({ ...prev, page: 1, q: searchInput }),
      })
    }, 450)
    return () => clearTimeout(t)
  }, [searchInput, navigate])

  const patchSearch = (patch: Partial<ProductosSearch>) => {
    navigate({
      to: "/productos",
      search: (prev) => ({ ...prev, ...patch, page: 1 }),
    })
  }

  const limpiar = () => {
    setSearchInput("")
    navigate({
      to: "/productos",
      search: {
        page: 1,
        q: "",
        categoria: "",
        estado_calidad: "",
        apto: "",
        bajo_stock: "",
        por_vencer: "",
      },
    })
  }

  return (
    <Flex align="center" gap={4} flexWrap="wrap" rowGap={3}>
      <Input
        placeholder="Buscar por nombre, marca, códigos o guía interna..."
        size="sm"
        maxW={{ base: "100%", md: "320px" }}
        flex={{ base: "1 1 100%", md: "1 1 auto" }}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
      />
      <Select
        value={categoriaSelectValue}
        onValueChange={(value) => patchSearch({ categoria: value })}
        style={{ maxWidth: "220px", minWidth: "160px" }}
      >
        <SelectItem value="">Todas las categorías</SelectItem>
        {CATEGORIAS_PRODUCTO.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </Select>

     
     
      <Select
        value={search.por_vencer}
        onValueChange={(value) => patchSearch({ por_vencer: value })}
        style={{ maxWidth: "200px", minWidth: "150px" }}
      >
        <SelectItem value="">Vencimiento (todos)</SelectItem>
        <SelectItem value="true">Por vencer</SelectItem>
      </Select>
      <Button variant="subtle" colorPalette="gray" size="sm" onClick={limpiar}>
        Limpiar filtros
      </Button>
    </Flex>
  )
}

function getProductosStatsQueryOptions() {
  return {
    queryFn: async () => {
      try {
        const response = await ProductosService.readStats()
        return response
      } catch (error) {
        console.error("Error in getProductosStats:", error)
        return { 
          total_productos: 0, 
          stock_total: 0, 
          productos_bajo_stock: 0,
          productos_sin_stock: 0,
          productos_por_vencer: 0,
          productos_vencidos: 0,
          lotes_activos: 0 
        }
      }
    },
    queryKey: ["productos-stats"],
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  }
}

function ProductosTable() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()

  const { data: config } = useQuery({
    queryKey: ["configuracion"],
    queryFn: () =>
      apiRequest(OpenAPI, {
        method: "GET",
        url: "/api/v1/configuracion/",
      }) as Promise<{ dias_alerta_vencimiento?: number }>,
    staleTime: 60_000,
  })
  const diasAlerta = config?.dias_alerta_vencimiento ?? 60

  const { data, isLoading } = useQuery({
    ...getProductosQueryOptions(search),
    placeholderData: (prevData) => prevData,
  })

  const setPage = (p: number) => {
    navigate({ to: "/productos", search: (prev) => ({ ...prev, page: p }) })
  }

  const productos = data?.data ?? []
  const count = data?.count ?? 0

  if (isLoading) {
    return <PendingItems />
  }

  if (productos.length === 0) {
    const filtrado = hasActiveProductosFilters(search)
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <FiSearch />
          </EmptyState.Indicator>
          <VStack textAlign="center">
            <EmptyState.Title>
              {filtrado ? "Sin resultados con estos filtros" : "No se encontraron productos"}
            </EmptyState.Title>
            <EmptyState.Description>
              {filtrado
                ? "Prueba a cambiar la búsqueda o los filtros, o usa «Limpiar filtros»."
                : "Aún no hay productos registrados en el sistema"}
            </EmptyState.Description>
          </VStack>
        </EmptyState.Content>
      </EmptyState.Root>
    )
  }

  const getCondicionColor = (condicion: string) => {
    if (condicion.includes("OPTIMAS") || condicion.includes("BUENAS")) return "green"
    if (condicion.includes("ACEPTABLES")) return "yellow"
    if (condicion.includes("DAÑADO") || condicion.includes("VENCIDO") || condicion.includes("NO APTO")) return "red"
    return "gray"
  }

  return (
    <>
      <Box overflowX="auto">
        <Table.Root size={{ base: "sm", md: "md" }}>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Producto</Table.ColumnHeader>
              <Table.ColumnHeader>Categoría</Table.ColumnHeader>
              <Table.ColumnHeader>Elaborado Por</Table.ColumnHeader>
              <Table.ColumnHeader>Marca</Table.ColumnHeader>
              <Table.ColumnHeader>Presentación</Table.ColumnHeader>
              <Table.ColumnHeader>Lote</Table.ColumnHeader>
              <Table.ColumnHeader>Vencimiento</Table.ColumnHeader>
              <Table.ColumnHeader>Condición</Table.ColumnHeader>
              <Table.ColumnHeader>Unidades</Table.ColumnHeader>
              <Table.ColumnHeader>Cant Kg</Table.ColumnHeader>
              <Table.ColumnHeader>Cant TM</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="center">Acción</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {productos.map((p: ProductoPublic) => {
              const diasParaVencer = getDiasParaVencer(p.fecha_vencimiento)
              const isVencido = diasParaVencer !== null && diasParaVencer < 0
              const isPorVencer =
                diasParaVencer !== null &&
                diasParaVencer >= 0 &&
                diasParaVencer <= diasAlerta
              const isCritical = p.unidades <= p.stock_minimo
              const puedeRetirar = puedeRetirarProducto(p, diasAlerta)

              return (
                <Table.Row key={p.id_producto}>
                  <Table.Cell>
                    <Text fontWeight="semibold" fontSize="sm">{p.nombre}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge colorPalette="blue" variant="subtle" fontSize="xs">{p.categoria}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text fontSize="xs" color="gray.600">{p.elaborado_por || "—"}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text fontSize="sm">{p.marca || "—"}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text fontSize="xs">{p.presentacion || "—"}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text fontSize="xs">{p.lote_producto || "S/L"}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    {p.retirado ? (
                      <VStack align="start" gap={1}>
                        <Badge colorPalette="gray" size="sm" variant="subtle">
                          Retirado
                        </Badge>
                        {p.fecha_vencimiento ? (
                          <Text fontSize="xs" color="fg.muted">
                            {new Date(p.fecha_vencimiento).toLocaleDateString("es-ES")}
                          </Text>
                        ) : (
                          <Text fontSize="xs" color="gray.400">
                            S/F
                          </Text>
                        )}
                      </VStack>
                    ) : p.fecha_vencimiento ? (
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs">
                          {new Date(p.fecha_vencimiento).toLocaleDateString("es-ES")}
                        </Text>
                        <Badge
                          colorPalette={isVencido ? "red" : isPorVencer ? "orange" : "green"}
                          size="sm"
                          fontSize="10px"
                        >
                          {isVencido
                            ? "Vencido"
                            : isPorVencer
                              ? `${diasParaVencer} días`
                              : "Vigente"}
                        </Badge>
                      </VStack>
                    ) : (
                      <Text fontSize="xs" color="gray.400">
                        S/F
                      </Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge colorPalette={getCondicionColor(p.condicion)} fontSize="10px">
                      {p.condicion}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge colorPalette={isCritical ? "red" : "green"}>
                      {p.unidades}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text fontSize="sm">{p.cantidad_kg.toFixed(2)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text fontSize="sm" fontWeight="medium">{p.cantidad_tm.toFixed(2)}</Text>
                  </Table.Cell>
                  <Table.Cell textAlign="center">
                    <RetirarProductoAction
                      idProducto={p.id_producto}
                      nombre={p.nombre}
                      canRetirar={puedeRetirar}
                      isRetirado={p.retirado === true}
                    />
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table.Root>
      </Box>

      <Flex justifyContent="flex-end" mt={4}>
        <PaginationRoot count={count} pageSize={PER_PAGE} onPageChange={({ page }) => setPage(page)}>
          <Flex>
            <PaginationPrevTrigger />
            <PaginationItems />
            <PaginationNextTrigger />
          </Flex>
        </PaginationRoot>
      </Flex>
    </>
  )
}

function StatsCards() {
  const { data: prodStats, isLoading: prodLoading, error: prodError } = useQuery<ProductosStats>(getProductosStatsQueryOptions())

  if (prodError) console.error("Error fetching productos stats:", prodError)

  const statsData = [
    {
      title: "Total Productos",
      value: prodStats?.total_productos ?? 0,
      icon: FiBox,
      color: "gray",
    },
    {
      title: "Stock Total (Unidades)",
      value: prodStats?.stock_total ?? 0,
      icon: FiBox,
      color: "blue",
    },
    {
      title: "Por Vencer",
      value: prodStats?.productos_por_vencer ?? 0,
      icon: FiAlertTriangle,
      color: "orange",
    },
  ]

  if (prodLoading) {
    return (
      <SimpleGrid columns={{ base: 1, md: 3 }} gap={4} mt={6}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Card.Root key={index} p={4} borderWidth="1px" borderColor="gray.200">
            <Card.Body>
              <Flex align="center" justify="space-between" mb={2}>
                <Text fontSize="sm" color="gray.500">Cargando...</Text>
                <Icon as={FiBox} fontSize="20px" color="gray.300" />
              </Flex>
              <Text fontSize="2xl" fontWeight="bold" color="gray.300">--</Text>
            </Card.Body>
          </Card.Root>
        ))}
      </SimpleGrid>
    )
  }

  return (
    <SimpleGrid columns={{ base: 1, md: 3 }} gap={4} mt={6}>
      {statsData.map((stat, index) => (
        <Card.Root key={index} p={4} borderWidth="1px" borderColor="gray.200">
          <Card.Body>
            <Flex align="center" justify="space-between" mb={2}>
              <Text fontSize="sm" color="gray.500">{stat.title}</Text>
              <Icon as={stat.icon} fontSize="20px" color={`${stat.color}.500`} />
            </Flex>
            <Text fontSize="2xl" fontWeight="bold" color={`${stat.color}.600`}>{stat.value}</Text>
          </Card.Body>
        </Card.Root>
      ))}
    </SimpleGrid>
  )
}

export default function Productos() {
  return (
    <Container maxW="full">
      <Flex align="center" justify="space-between" pt={10}>
        <Box>
          <Heading size="4xl" fontWeight="bold">
            Gestión de Productos
          </Heading>
          <Heading size="lg" fontWeight="semibold" mt={2}>
            Inventario de productos en almacén
          </Heading>
        </Box>
      </Flex>

      <StatsCards />

      <Text fontSize="lg" fontWeight="medium" mb={2} mt={8}>
        Filtros de búsqueda
      </Text>
      <ProductosFiltersBar />

      <Box mt={6}>
        <ProductosTable />
      </Box>
    </Container>
  )
}
