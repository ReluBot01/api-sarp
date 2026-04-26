import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  EmptyState,
  Flex,
  Heading,
  Icon,
  Input,
  SimpleGrid,
  Table,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { FiEdit2, FiPackage, FiSearch } from "react-icons/fi"
import { useState, useEffect } from "react"
import { z } from "zod"

import {
  LotesService,
  type LoteEdicionRegistroPublic,
  type LotePublic,
  type LotePublicExtended,
  type LotesStats,
} from "@/client"
import { EliminarGuiaConfirmButton } from "@/components/Lotes/GuiaConfirmActions"
import { EdicionLoteDialog } from "@/components/Lotes/EdicionLoteDialog"
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination"
import { Select, SelectItem } from "@/components/ui/select"
import useAuth from "@/hooks/useAuth"
import { pesoLineaKg } from "@/utils/pesoRecepcion"
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const lotesSearchSchema = z.object({
  page: z.number().catch(1),
  q: z.string().catch(""),
})

const PER_PAGE = 10

function normalizarPesosLote(peso: number, unidad: string | null | undefined) {
  const u = (unidad || "kg").trim().toLowerCase()
  if (u === "tm") {
    return {
      kg: peso * 1000,
      tm: peso,
    }
  }
  return {
    kg: peso,
    tm: peso / 1000,
  }
}

function getLotesQueryOptions({ page, q }: { page: number; q: string }) {
  return {
    queryFn: () =>
      LotesService.readLotes({
        skip: (page - 1) * PER_PAGE,
        limit: PER_PAGE,
        q: q || undefined,
      }),
    queryKey: ["lotes", { page, q }],
  }
}

function getLotesStatsQueryOptions() {
  return {
    queryFn: async () => {
      try {
        return await LotesService.getLotesStats()
      } catch (error) {
        console.error("Error in getLotesStats:", error)
        throw error
      }
    },
    queryKey: ["lotes-stats"],
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  }
}

export const Route = createFileRoute("/_layout/lotes")({
  component: Lotes,
  validateSearch: (search) => lotesSearchSchema.parse(search),
})

function LoteDetalleDialog({
  lote,
  onOpen,
}: {
  lote: LotePublic
  onOpen: () => void
}) {
  return (
    <DialogTrigger asChild>
      <Text
        fontWeight="medium"
        color="blue.600"
        cursor="pointer"
        textDecoration="underline"
        onClick={onOpen}
      >
        {lote.numero_lote}
      </Text>
    </DialogTrigger>
  )
}

function LoteDetalleContent({ loteId }: { loteId: number }) {
  const { data, isLoading, error } = useQuery<LotePublicExtended>({
    queryKey: ["lote", loteId],
    queryFn: () => LotesService.readLote({ id: loteId }),
    staleTime: 0,
  })

  if (isLoading) {
    return <Text>Cargando detalle de la guia...</Text>
  }

  if (error || !data) {
    return <Text color="red.500">No se pudo cargar el detalle de la guia.</Text>
  }

  const productos = data.productos || []

  return (
    <VStack align="stretch" gap={4}>
      <VStack align="stretch" gap={1}>
        <Text fontSize="sm" color="gray.600">
          Observaciones de la guia
        </Text>
        <Text
          fontSize="sm"
          whiteSpace="pre-wrap"
          overflowWrap="anywhere"
          wordBreak="break-word"
          maxW="100%"
        >
          {data.observaciones || "—"}
        </Text>
      </VStack>

      <Text fontSize="sm" color="gray.600">
        Productos en la guia ({productos.length})
      </Text>

      <Box
        w="100%"
        maxW="100%"
        minW={0}
        overflowX="auto"
        overflowY="auto"
        borderWidth="1px"
        borderRadius="md"
        borderColor="gray.200"
        /**
         * Altura máxima aproximada para 10 filas visibles.
         * Si hay más de 10 productos, el scroll vertical ocurre dentro de este contenedor,
         * manteniendo el tamaño del modal estable.
         */
        maxH={{ base: "50vh", md: "520px" }}
      >
        <Table.Root
          size="sm"
          style={{
            tableLayout: "fixed",
            width: "max-content",
            minWidth: "100%",
          }}
        >
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader style={{ width: "180px" }}>Nombre</Table.ColumnHeader>
              <Table.ColumnHeader style={{ width: "120px" }}>Marca</Table.ColumnHeader>
              <Table.ColumnHeader style={{ width: "120px" }}>Categoría</Table.ColumnHeader>
              <Table.ColumnHeader style={{ width: "180px" }}>Presentación</Table.ColumnHeader>
              <Table.ColumnHeader style={{ width: "120px" }}>Guia</Table.ColumnHeader>
              <Table.ColumnHeader style={{ width: "140px" }}>Fecha Elaborado</Table.ColumnHeader>
              <Table.ColumnHeader style={{ width: "140px" }}>Fecha Vencimiento</Table.ColumnHeader>
              <Table.ColumnHeader style={{ width: "200px" }}>Uso Recomendado</Table.ColumnHeader>
              <Table.ColumnHeader style={{ width: "200px" }}>Causa de Daño Principal</Table.ColumnHeader>
              <Table.ColumnHeader style={{ width: "140px", textAlign: "right" }}>TM / unidad</Table.ColumnHeader>
              <Table.ColumnHeader style={{ width: "140px", textAlign: "right" }}>Kg / unidad</Table.ColumnHeader>
              <Table.ColumnHeader style={{ width: "120px", textAlign: "right" }}>Unidades</Table.ColumnHeader>
              <Table.ColumnHeader style={{ width: "140px", textAlign: "right" }}>Subtotal (kg)</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {productos.map((p) => (
              <Table.Row key={p.id_producto}>
                <Table.Cell>
                  <Text fontSize="sm" whiteSpace="normal" overflowWrap="anywhere">
                    {p.nombre || "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text fontSize="sm" whiteSpace="normal" overflowWrap="anywhere">
                    {p.marca || "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text fontSize="sm" whiteSpace="normal" overflowWrap="anywhere">
                    {p.categoria || "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text fontSize="sm" whiteSpace="normal" overflowWrap="anywhere">
                    {p.presentacion || "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text fontSize="sm" whiteSpace="normal" overflowWrap="anywhere">
                    {p.lote_producto || "S/L"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  {p.fecha_elaboracion ? new Date(p.fecha_elaboracion).toLocaleDateString("es-ES") : "S/F"}
                </Table.Cell>
                <Table.Cell>
                  {p.fecha_vencimiento ? new Date(p.fecha_vencimiento).toLocaleDateString("es-ES") : "S/F"}
                </Table.Cell>
                <Table.Cell>
                  <Text fontSize="sm" whiteSpace="normal" overflowWrap="anywhere">
                    {p.uso_recomendado || "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text fontSize="sm" whiteSpace="normal" overflowWrap="anywhere">
                    {p.condicion || "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell textAlign="right">{(p.cantidad_tm ?? 0).toLocaleString()}</Table.Cell>
                <Table.Cell textAlign="right">{(p.cantidad_kg ?? 0).toLocaleString()}</Table.Cell>
                <Table.Cell textAlign="right">{(p.unidades ?? 0).toLocaleString()}</Table.Cell>
                <Table.Cell textAlign="right">
                  {pesoLineaKg(p.cantidad_kg, p.unidades).toLocaleString()}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    </VStack>
  )
}

function RegistroEdicionPanel({
  loteId,
  lotesConEdicion,
  onSelectLote,
}: {
  loteId: number | null
  lotesConEdicion: LotePublic[]
  onSelectLote: (id: number | null) => void
}) {
  const { data, isLoading } = useQuery<LotePublicExtended>({
    queryKey: ["lote", loteId, "registro"],
    queryFn: () => LotesService.readLote({ id: loteId! }),
    enabled: loteId != null,
  })

  const reg: LoteEdicionRegistroPublic | null | undefined = data?.registro_edicion
  const detalleRaw =
    reg?.detalle && typeof reg.detalle === "object" ? (reg.detalle as Record<string, unknown>) : null
  const peso = detalleRaw && "peso_kg" in detalleRaw
    ? (detalleRaw.peso_kg as { antes?: number; despues?: number; delta?: number })
    : undefined
  const detalleProductos = Array.isArray(detalleRaw?.detalle_productos)
    ? (detalleRaw.detalle_productos as {
        id_producto: number
        antes: { nombre?: string }
        despues: { nombre?: string }
      }[])
    : []
  const cambiosNombre = detalleProductos.filter(
    (d) => (d.antes?.nombre || "") !== (d.despues?.nombre || ""),
  )

  return (
    <Card.Root mt={6} variant="outline">
      <Card.Body>
        <Heading size="sm" mb={3}>
          Registro de edición única
        </Heading>
        <Text fontSize="sm" color="gray.600" mb={3}>
          Solo se permite una edición por guia. Aquí se muestra quién modificó, cuándo y el impacto en
          peso (según productos).
        </Text>
        {lotesConEdicion.length === 0 ? (
          <Text fontSize="sm" color="gray.500">
            En esta página no hay guias con edición ya guardada.
          </Text>
        ) : (
          <>
            <Flex align="center" gap={3} mb={4} flexWrap="wrap">
              <Text fontSize="sm" fontWeight="medium">
                Guia:
              </Text>
              <Select
                placeholder="Seleccione una guia"
                value={loteId != null ? String(loteId) : ""}
                onValueChange={(v) => onSelectLote(v ? Number(v) : null)}
                style={{ maxWidth: "320px" }}
              >
                {lotesConEdicion.map((l) => (
                  <SelectItem key={l.id_lote} value={String(l.id_lote)}>
                    {l.numero_lote}
                  </SelectItem>
                ))}
              </Select>
            </Flex>
            {loteId == null ? (
              <Text fontSize="sm" color="gray.500">
                Elija una guia para ver el registro.
              </Text>
            ) : isLoading ? (
              <Text fontSize="sm">Cargando registro…</Text>
            ) : !reg ? (
              <Text fontSize="sm" color="gray.500">
                No hay registro de edición para esta guia.
              </Text>
            ) : (
              <VStack align="stretch" gap={2} fontSize="sm">
                <Text>
                  <Text as="span" fontWeight="semibold">
                    Usuario:
                  </Text>{" "}
                  {reg.usuario_nombre || "—"}{" "}
                  <Text as="span" color="gray.500">
                    (ID: {reg.id_usuario})
                  </Text>
                </Text>
                <Text>
                  <Text as="span" fontWeight="semibold">
                    Fecha de modificación:
                  </Text>{" "}
                  {new Date(reg.fecha_modificacion).toLocaleString("es-ES", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </Text>
                <Box>
                  <Text fontWeight="semibold" mb={1}>
                    Qué se editó
                  </Text>
                  <Text whiteSpace="pre-wrap">
                    {(reg.resumen || "—").replaceAll(" (Σ kg/unidad × unidades)", "")}
                  </Text>
                </Box>
                {cambiosNombre.length > 0 && (
                  <Box>
                    <Text fontWeight="semibold" mb={1}>
                      Cambios de nombre de producto
                    </Text>
                    <VStack align="stretch" gap={1}>
                      {cambiosNombre.map((d) => (
                        <Text key={d.id_producto} fontSize="sm">
                          #{d.id_producto}: &quot;{d.antes?.nombre ?? "—"}&quot; → &quot;
                          {d.despues?.nombre ?? "—"}&quot;
                        </Text>
                      ))}
                    </VStack>
                  </Box>
                )}
                {peso && (
                  <Box
                    p={3}
                    borderRadius="md"
                    bg="bg.muted"
                    borderWidth="1px"
                    borderColor="border.subtle"
                  >
                    <Text fontWeight="semibold" mb={1}>
                      Peso total de la guia
                    </Text>
                    <Text>
                      Antes: {(peso.antes ?? 0).toLocaleString()} kg → Después:{" "}
                      {(peso.despues ?? 0).toLocaleString()} kg
                    </Text>
                    <Text>
                      Variación:{" "}
                      {(peso.delta ?? 0) > 0.0001
                        ? `+${(peso.delta ?? 0).toLocaleString()} kg (aumento)`
                        : (peso.delta ?? 0) < -0.0001
                          ? `${(peso.delta ?? 0).toLocaleString()} kg (disminución)`
                          : "sin cambio relevante"}
                    </Text>
                  </Box>
                )}
              </VStack>
            )}
          </>
        )}
      </Card.Body>
    </Card.Root>
  )
}

function StatsCards() {
  const { data: stats, isLoading, error } = useQuery<LotesStats>(getLotesStatsQueryOptions())
  
  if (error) {
    console.error("Error fetching stats:", error)
  }
  
  const pesoStats = normalizarPesosLote(stats?.peso_total_almacen || 0, stats?.unidad_peso || "kg")

  const statsData = [
    {
      title: "Total Guias",
      value: stats?.total_lotes || 0,
      icon: FiPackage,
      color: "gray",
    },
    {
      title: "Peso Total",
      value: `${pesoStats.kg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`,
      subValue: `${pesoStats.tm.toLocaleString(undefined, { maximumFractionDigits: 4 })} TM`,
      icon: FiPackage,
      color: "purple",
    },
  ]

  if (isLoading) {
    return (
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} mb={6} maxW="720px">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card.Root key={index} p={4}>
            <Card.Body>
              <Flex align="center" justify="space-between" mb={2}>
                <Text fontSize="sm" color="gray.500">Cargando...</Text>
                <Icon as={FiPackage} fontSize="20px" color="gray.300" />
              </Flex>
              <Text fontSize="2xl" fontWeight="bold" color="gray.300">
                --
              </Text>
            </Card.Body>
          </Card.Root>
        ))}
      </SimpleGrid>
    )
  }

  return (
    <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} mb={6} maxW="720px">
      {statsData.map((stat, index) => (
        <Card.Root key={index} p={4}>
          <Card.Body>
            <Flex align="center" justify="space-between" mb={2}>
              <Text fontSize="sm" color="gray.500">
                {stat.title}
              </Text>
              <Icon as={stat.icon} fontSize="20px" color={`${stat.color}.500`} />
            </Flex>
            <Text fontSize="2xl" fontWeight="bold" color={`${stat.color}.600`}>
              {stat.value}
            </Text>
            {"subValue" in stat ? (
              <Text fontSize="2xl" fontWeight="bold" color="green.600" mt={1}>
                {stat.subValue}
              </Text>
            ) : null}
          </Card.Body>
        </Card.Root>
      ))}
    </SimpleGrid>
  )
}

function LotesTable() {
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()
  const { page, q } = Route.useSearch()
  const [detalleOpen, setDetalleOpen] = useState(false)
  const [detalleLoteId, setDetalleLoteId] = useState<number | null>(null)
  const [proveedoresModalLote, setProveedoresModalLote] = useState<LotePublic | null>(null)
  const [edicionOpen, setEdicionOpen] = useState(false)
  const [edicionLoteId, setEdicionLoteId] = useState<number | null>(null)
  const [registroLoteId, setRegistroLoteId] = useState<number | null>(null)

  const { data, isLoading, isPlaceholderData } = useQuery({
    ...getLotesQueryOptions({ page, q: q || "" }),
    placeholderData: (prevData) => prevData,
  })

  const lotes: LotePublic[] = data?.data ?? []
  const count = data?.count ?? 0
  const lotesConEdicion = lotes.filter((l) => l.edicion_realizada)

  useEffect(() => {
    const con = lotes.filter((l) => l.edicion_realizada)
    setRegistroLoteId((prev) => {
      if (prev != null && con.some((l) => l.id_lote === prev)) {
        return prev
      }
      return con[0]?.id_lote ?? null
    })
  }, [lotes])

  const setPage = (newPage: number) => {
    navigate({
      to: "/lotes",
      search: { page: newPage, q: q || "" },
    })
  }

  if (isLoading && !isPlaceholderData) {
    return (
      <Table.Root size={{ base: "sm", md: "md" }}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Guia</Table.ColumnHeader>
            <Table.ColumnHeader>Fecha Llegada</Table.ColumnHeader>
            <Table.ColumnHeader>Proveedor</Table.ColumnHeader>
            <Table.ColumnHeader>Productos</Table.ColumnHeader>
            <Table.ColumnHeader>Peso Total kg</Table.ColumnHeader>
            <Table.ColumnHeader>Peso Total TM</Table.ColumnHeader>
            {isAdmin ? <Table.ColumnHeader>Acciones</Table.ColumnHeader> : null}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {Array.from({ length: PER_PAGE }).map((_, i) => (
            <Table.Row key={i}>
              <Table.Cell>...</Table.Cell>
              <Table.Cell>...</Table.Cell>
              <Table.Cell>...</Table.Cell>
              <Table.Cell>...</Table.Cell>
              <Table.Cell>...</Table.Cell>
              <Table.Cell>...</Table.Cell>
              {isAdmin ? <Table.Cell>...</Table.Cell> : null}
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    )
  }

  return (
    <>
      <DialogRoot
        open={detalleOpen}
        onOpenChange={({ open }) => {
          setDetalleOpen(open)
          if (!open) setDetalleLoteId(null)
        }}
        size={{ base: "full", md: "xl" }}
        placement="center"
      >
        <DialogContent
          maxW={{ base: "100dvw", md: "min(96vw, 1600px)" }}
          w={{ base: "100%", md: "min(96vw, 1600px)" }}
          minW={0}
        >
          <DialogHeader>
            <DialogTitle>Detalle de la guia</DialogTitle>
          </DialogHeader>
          <DialogBody maxW="100%" minW={0}>
            {detalleLoteId ? <LoteDetalleContent loteId={detalleLoteId} /> : null}
          </DialogBody>
          <DialogFooter>
            <DialogActionTrigger asChild>
              <Button variant="ghost">Cerrar</Button>
            </DialogActionTrigger>
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
      </DialogRoot>

      <DialogRoot
        open={proveedoresModalLote != null}
        onOpenChange={({ open }) => {
          if (!open) setProveedoresModalLote(null)
        }}
        size="sm"
        placement="center"
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Proveedores de la guía</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {proveedoresModalLote ? (
              <VStack align="stretch" gap={2}>
                {(proveedoresModalLote.proveedores?.length
                  ? [...proveedoresModalLote.proveedores].sort((a, b) => a.orden - b.orden)
                  : proveedoresModalLote.proveedor_nombre
                    ? [
                        {
                          id_proveedor: proveedoresModalLote.id_proveedor,
                          nombre: proveedoresModalLote.proveedor_nombre,
                          orden: 0,
                        },
                      ]
                    : []
                ).map((p, idx) => (
                  <Flex
                    key={`${p.id_proveedor}-${p.orden}-${idx}`}
                    justify="space-between"
                    align="center"
                    gap={2}
                    py={1}
                    borderBottomWidth="1px"
                    borderColor="gray.100"
                  >
                    <Text fontSize="sm" fontWeight="medium">
                      {idx + 1}. {p.nombre ?? `Proveedor #${p.id_proveedor}`}
                    </Text>
                    {idx === 0 ? (
                      <Badge size="sm" colorPalette="blue">
                        Principal
                      </Badge>
                    ) : null}
                  </Flex>
                ))}
                {!(
                  proveedoresModalLote.proveedores?.length ||
                  proveedoresModalLote.proveedor_nombre
                ) ? (
                  <Text fontSize="sm" color="gray.500">
                    Sin datos de proveedor.
                  </Text>
                ) : null}
              </VStack>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <DialogActionTrigger asChild>
              <Button variant="ghost">Cerrar</Button>
            </DialogActionTrigger>
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
      </DialogRoot>

      <Table.Root size={{ base: "sm", md: "md" }}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Guia</Table.ColumnHeader>
            <Table.ColumnHeader>Fecha Llegada</Table.ColumnHeader>
            <Table.ColumnHeader>Proveedor</Table.ColumnHeader>
            <Table.ColumnHeader>Productos</Table.ColumnHeader>
            <Table.ColumnHeader>Peso Total kg</Table.ColumnHeader>
            <Table.ColumnHeader>Peso Total TM</Table.ColumnHeader>
            {isAdmin ? <Table.ColumnHeader>Acciones</Table.ColumnHeader> : null}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {lotes?.map((lote: LotePublic) => (
            <Table.Row key={lote.id_lote} opacity={isPlaceholderData ? 0.5 : 1}>
              <Table.Cell>
                <DialogRoot
                  open={detalleOpen && detalleLoteId === lote.id_lote}
                  onOpenChange={() => {
                    /* controlado por el DialogRoot global */
                  }}
                >
                  <LoteDetalleDialog
                    lote={lote}
                    onOpen={() => {
                      setDetalleLoteId(lote.id_lote)
                      setDetalleOpen(true)
                    }}
                  />
                </DialogRoot>
              </Table.Cell>
              <Table.Cell>
                <Text fontSize="sm">
                  {new Date(lote.fecha_llegada).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </Table.Cell>
              <Table.Cell>
                {(() => {
                  const ordenados = lote.proveedores?.length
                    ? [...lote.proveedores].sort((a, b) => a.orden - b.orden)
                    : []
                  const principalNombre =
                    ordenados[0]?.nombre ?? lote.proveedor_nombre ?? "—"
                  const varios = ordenados.length > 1
                  return (
                    <Box
                      as="span"
                      display="inline-block"
                      maxW={{ base: "200px", md: "280px" }}
                      onDoubleClick={() => setProveedoresModalLote(lote)}
                      cursor="pointer"
                      title="Doble clic para ver la lista de proveedores"
                    >
                      <Text
                        fontSize="sm"
                        fontWeight={varios ? "semibold" : "normal"}
                        color={varios ? "orange.700" : undefined}
                        lineClamp={2}
                      >
                        {principalNombre}
                        {varios ? (
                          <Badge ml={2} size="sm" colorPalette="orange">
                            +{ordenados.length - 1}
                          </Badge>
                        ) : null}
                      </Text>
                    </Box>
                  )
                })()}
              </Table.Cell>
              <Table.Cell>
                <Badge colorPalette="blue">{lote.total_productos || 0}</Badge>
              </Table.Cell>
              {(() => {
                const pesos = normalizarPesosLote(lote.peso_total_recibido, lote.unidad_peso)
                return (
                  <>
                    <Table.Cell>
                      <Text fontSize="sm">
                        {pesos.kg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontSize="sm">
                        {pesos.tm.toLocaleString(undefined, { maximumFractionDigits: 4 })} TM
                      </Text>
                    </Table.Cell>
                  </>
                )
              })()}
              {isAdmin ? (
                <Table.Cell>
                  <Flex gap={2} align="center" flexWrap="wrap">
                    {lote.estado === "Activo" && !lote.edicion_realizada && (
                      <Button
                        size="xs"
                        variant="outline"
                        colorPalette="blue"
                        title="Edición única (solo una vez)"
                        onClick={() => {
                          setEdicionLoteId(lote.id_lote)
                          setEdicionOpen(true)
                        }}
                      >
                        <Icon as={FiEdit2} />
                      </Button>
                    )}
                    <EliminarGuiaConfirmButton idLote={lote.id_lote} numeroGuia={lote.numero_lote} />
                  </Flex>
                </Table.Cell>
              ) : null}
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      {isAdmin ? (
        <EdicionLoteDialog
          loteId={edicionLoteId}
          open={edicionOpen}
          onOpenChange={(open) => {
            setEdicionOpen(open)
            if (!open) {
              setEdicionLoteId(null)
            }
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["lotes"] })
            queryClient.invalidateQueries({ queryKey: ["lotes-stats"] })
            if (edicionLoteId != null) {
              setRegistroLoteId(edicionLoteId)
            }
          }}
        />
      ) : null}

      <RegistroEdicionPanel
        loteId={registroLoteId}
        lotesConEdicion={lotesConEdicion}
        onSelectLote={setRegistroLoteId}
      />

      {lotes.length === 0 && !isLoading && (
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <FiSearch />
            </EmptyState.Indicator>
            <VStack textAlign="center">
              <EmptyState.Title>No se encontraron guias</EmptyState.Title>
              <EmptyState.Description>
                {q
                  ? "Intenta ajustar los filtros de búsqueda"
                  : "Aún no hay guias registradas en el sistema"}
              </EmptyState.Description>
            </VStack>
          </EmptyState.Content>
        </EmptyState.Root>
      )}
      {count > 0 && (
        <Flex justifyContent="flex-end" mt={4}>
          <PaginationRoot
            count={count}
            pageSize={PER_PAGE}
            onPageChange={({ page }) => setPage(page)}
          >
            <Flex>
              <PaginationPrevTrigger />
              <PaginationItems />
              <PaginationNextTrigger />
            </Flex>
          </PaginationRoot>
        </Flex>
      )}
    </>
  )
}

function Lotes() {
  const navigate = useNavigate()
  const { q } = Route.useSearch()
  const [searchQuery, setSearchQuery] = useState<string>(q || "")

  useEffect(() => {
    setSearchQuery(q || "")
  }, [q])

  // Debounce para la búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== (q || "")) {
        navigate({
          to: "/lotes",
          search: {
            page: 1,
            q: searchQuery || "",
          },
        })
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Container maxW="full">
      <Heading size="lg" pt={12} mb={6}>
        Gestión de Guias
      </Heading>
      <Text mb={6} color="gray.600">
        Control de guias recibidas en el almacén
      </Text>

      <StatsCards />
      
      <Text fontSize="lg" fontWeight="medium" mb={2}>
        Filtros de búsqueda
      </Text>
      <Flex justify="space-between" align="center" mb={4}>
        <Flex align="center" gap={4}>
          <Input
            placeholder="Buscar por número de guia..."
            size="sm"
            maxW="300px"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button
            variant="subtle"
            colorPalette="gray"
            onClick={() => {
              setSearchQuery("")
              navigate({
                to: "/lotes",
                search: { page: 1, q: "" },
              })
            }}
          >
            Limpiar filtros
          </Button>
        </Flex>
      </Flex>
      <LotesTable />
    </Container>
  )
}

export default Lotes
