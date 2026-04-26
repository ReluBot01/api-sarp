import {
  Box,
  Button,
  Flex,
  Heading,
  IconButton,
  Input,
  NativeSelect,
  Text,
  VStack,
} from "@chakra-ui/react"
import { FiArrowDown, FiArrowUp, FiTrash2 } from "react-icons/fi"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import {
  LotesService,
  type LoteEdicionUnicaRequest,
  type LotePublicExtended,
  type ProductoEdicionUnicaItem,
  type ProductoPublic,
  ProveedoresService,
  type ProveedorPublic,
} from "@/client"
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import useCustomToast from "@/hooks/useCustomToast"
import {
  gramosPorUnidadDesdeKg,
  kgPorUnidadDesdeGramos,
  kgPorUnidadDesdeTm,
  pesoLineaKg,
  tmPorUnidadDesdeKg,
} from "@/utils/pesoRecepcion"

function productoToEdicionItem(p: ProductoPublic): ProductoEdicionUnicaItem {
  return {
    id_producto: p.id_producto,
    nombre: p.nombre,
    categoria: p.categoria,
    id_fabricante: p.id_fabricante ?? null,
    elaborado_por: p.elaborado_por ?? null,
    marca: p.marca ?? null,
    presentacion: p.presentacion ?? null,
    lote_producto: p.lote_producto ?? null,
    fecha_elaboracion: p.fecha_elaboracion ?? null,
    fecha_vencimiento: p.fecha_vencimiento ?? null,
    uso_recomendado: p.uso_recomendado,
    condicion: p.condicion,
    cantidad_tm: p.cantidad_tm,
    cantidad_kg: p.cantidad_kg,
    unidades: p.unidades,
    estado_calidad: p.estado_calidad,
    apto_consumo: p.apto_consumo,
    motivo_rechazo: p.motivo_rechazo ?? null,
    stock_minimo: p.stock_minimo,
    descripcion: p.descripcion ?? null,
    codigo_interno: p.codigo_interno ?? null,
    codigo_barras: p.codigo_barras ?? null,
    estado: p.estado,
  }
}

type Props = {
  loteId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EdicionLoteDialog({ loteId, open, onOpenChange, onSuccess }: Props) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [numeroLote, setNumeroLote] = useState("")
  const [idProveedores, setIdProveedores] = useState<number[]>([])
  const [productos, setProductos] = useState<ProductoEdicionUnicaItem[]>([])

  const loteQuery = useQuery({
    queryKey: ["lote", loteId, "edicion"],
    queryFn: () => LotesService.readLote({ id: loteId! }),
    enabled: open && loteId != null,
  })

  const proveedoresQuery = useQuery({
    queryKey: ["proveedores", "edicion-lote"],
    queryFn: async () => {
      const res = await ProveedoresService.readProveedores({ skip: 0, limit: 1000 })
      return res.data as ProveedorPublic[]
    },
    enabled: open,
  })

  useEffect(() => {
    const d = loteQuery.data as LotePublicExtended | undefined
    if (!d || !open) return
    setNumeroLote(d.numero_lote)
    const ordenados =
      d.proveedores?.length && d.proveedores.length > 0
        ? [...d.proveedores].sort((a, b) => a.orden - b.orden)
        : []
    setIdProveedores(
      ordenados.length > 0
        ? ordenados.map((x) => x.id_proveedor)
        : d.id_proveedor
          ? [d.id_proveedor]
          : [],
    )
    setProductos((d.productos || []).map((p) => productoToEdicionItem(p)))
  }, [loteQuery.data, open])

  const mutation = useMutation({
    mutationFn: (body: LoteEdicionUnicaRequest) =>
      LotesService.edicionUnicaLote({ id: loteId!, requestBody: body }),
    onSuccess: () => {
      showSuccessToast("Edición guardada. No podrás volver a editar esta guia.")
      queryClient.invalidateQueries({ queryKey: ["lotes"] })
      queryClient.invalidateQueries({ queryKey: ["lotes-stats"] })
      queryClient.invalidateQueries({ queryKey: ["lote"] })
      onSuccess()
      onOpenChange(false)
    },
    onError: (e: any) => {
      showErrorToast(e?.body?.detail || "No se pudo guardar la edición")
    },
  })

  const updateProducto = (idx: number, patch: Partial<ProductoEdicionUnicaItem>) => {
    setProductos((prev) => {
      const n = [...prev]
      n[idx] = { ...n[idx], ...patch }
      return n
    })
  }

  const handleSubmit = () => {
    if (!loteId) return
    const ids = idProveedores.filter((x, i, arr) => x > 0 && arr.indexOf(x) === i)
    if (ids.length === 0) return
    mutation.mutate({
      numero_lote: loteData?.numero_lote ?? numeroLote.trim(),
      id_proveedores: ids,
      id_proveedor: ids[0],
      productos,
    })
  }

  const listaProv = proveedoresQuery.data || []
  const nombrePorId = Object.fromEntries(listaProv.map((p) => [p.id_proveedor, p.nombre]))

  const agregarProveedor = (id: number) => {
    if (!id || idProveedores.includes(id)) return
    setIdProveedores((prev) => [...prev, id])
  }

  const quitarProveedor = (index: number) => {
    setIdProveedores((prev) => prev.filter((_, i) => i !== index))
  }

  const moverProveedor = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= idProveedores.length) return
    setIdProveedores((prev) => {
      const next = [...prev]
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }

  const loading = loteQuery.isLoading || !loteQuery.data
  const loteData = loteQuery.data as LotePublicExtended | undefined

  return (
    <DialogRoot open={open} onOpenChange={(e) => onOpenChange(e.open)} size="xl">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edición única de la guia</DialogTitle>
          <Text fontSize="sm" color="gray.600" mt={1}>
            Solo puedes guardar una vez. Luego la guia quedará bloqueada para nuevas ediciones.
          </Text>
        </DialogHeader>
        <DialogBody>
          {loading ? (
            <Text>Cargando…</Text>
          ) : loteData?.edicion_realizada ? (
            <Text color="red.600">Esta guia ya fue editada.</Text>
          ) : (
            <VStack align="stretch" gap={4}>
              <Field label="Número de guia">
                <Input
                  value={numeroLote}
                  readOnly
                  disabled
                />
              </Field>
              <Field
                label="Proveedores de la guía"
                helperText="El primero es el principal. Ordene con las flechas."
              >
                <VStack align="stretch" gap={2}>
                  <NativeSelect.Root size="sm">
                    <NativeSelect.Field
                      value=""
                      onChange={(e) => {
                        const v = Number(e.currentTarget.value)
                        if (v) agregarProveedor(v)
                        e.currentTarget.value = ""
                      }}
                    >
                      <option value="">Agregar proveedor…</option>
                      {listaProv
                        .filter((pr) => !idProveedores.includes(pr.id_proveedor))
                        .map((pr) => (
                          <option key={pr.id_proveedor} value={pr.id_proveedor}>
                            {pr.nombre}
                          </option>
                        ))}
                    </NativeSelect.Field>
                  </NativeSelect.Root>
                  {idProveedores.length === 0 ? (
                    <Text fontSize="sm" color="gray.600">
                      Agregue al menos un proveedor.
                    </Text>
                  ) : (
                    <VStack align="stretch" gap={1}>
                      {idProveedores.map((pid, index) => (
                        <Flex
                          key={`${pid}-${index}`}
                          justify="space-between"
                          align="center"
                          gap={2}
                          py={1}
                          px={2}
                          borderWidth="1px"
                          borderRadius="md"
                          borderColor="gray.200"
                        >
                          <Text fontSize="sm">
                            <Text as="span" fontWeight="semibold" color="blue.600">
                              {index + 1}.
                            </Text>{" "}
                            {nombrePorId[pid] ?? `ID ${pid}`}
                            {index === 0 ? (
                              <Text as="span" fontSize="xs" color="gray.500" ml={2}>
                                (principal)
                              </Text>
                            ) : null}
                          </Text>
                          <Flex gap={0}>
                            <IconButton
                              size="xs"
                              variant="ghost"
                              aria-label="Subir"
                              disabled={index === 0}
                              onClick={() => moverProveedor(index, -1)}
                            >
                              <FiArrowUp />
                            </IconButton>
                            <IconButton
                              size="xs"
                              variant="ghost"
                              aria-label="Bajar"
                              disabled={index === idProveedores.length - 1}
                              onClick={() => moverProveedor(index, 1)}
                            >
                              <FiArrowDown />
                            </IconButton>
                            <IconButton
                              size="xs"
                              variant="ghost"
                              colorPalette="red"
                              aria-label="Quitar"
                              onClick={() => quitarProveedor(index)}
                            >
                              <FiTrash2 />
                            </IconButton>
                          </Flex>
                        </Flex>
                      ))}
                    </VStack>
                  )}
                </VStack>
              </Field>
              <Heading size="sm">Productos de la guia</Heading>
              <Box maxH="360px" overflowY="auto" borderWidth="1px" borderRadius="md" p={2}>
                {productos.map((prod, idx) => (
                  <Box
                    key={prod.id_producto}
                    borderBottomWidth={idx < productos.length - 1 ? "1px" : 0}
                    pb={3}
                    mb={3}
                  >
                    <Text fontSize="xs" color="gray.500" mb={2}>
                      Producto #{prod.id_producto}
                    </Text>
                    <Text fontSize="xs" color="gray.600" mb={1}>
                      Peso por unidad · subtotal línea:{" "}
                      {pesoLineaKg(prod.cantidad_kg, prod.unidades).toFixed(2)} kg
                    </Text>
                    <Flex gap={2} wrap="wrap">
                      <Field label="Nombre">
                        <Input
                          size="sm"
                          value={prod.nombre || ""}
                          onChange={(e) =>
                            updateProducto(idx, { nombre: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Marca">
                        <Input
                          size="sm"
                          value={prod.marca || ""}
                          onChange={(e) =>
                            updateProducto(idx, { marca: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Kg por unidad">
                        <Input
                          size="sm"
                          type="number"
                          step="0.01"
                          value={prod.cantidad_kg ?? 0}
                          onChange={(e) => {
                            const kg = Number(e.target.value) || 0
                            updateProducto(idx, {
                              cantidad_kg: kg,
                              cantidad_tm: tmPorUnidadDesdeKg(kg),
                            })
                          }}
                        />
                      </Field>
                      <Field label="Gramos por unidad">
                        <Input
                          size="sm"
                          type="number"
                          step="0.1"
                          value={gramosPorUnidadDesdeKg(prod.cantidad_kg ?? 0)}
                          onChange={(e) => {
                            const gr = Number(e.target.value) || 0
                            const kg = kgPorUnidadDesdeGramos(gr)
                            updateProducto(idx, {
                              cantidad_kg: kg,
                              cantidad_tm: tmPorUnidadDesdeKg(kg),
                            })
                          }}
                          title="Se persiste como kg/unidad en el servidor"
                        />
                      </Field>
                      <Field label="TM por unidad">
                        <Input
                          size="sm"
                          type="number"
                          step="0.0001"
                          value={prod.cantidad_tm ?? 0}
                          onChange={(e) => {
                            const tm = Number(e.target.value) || 0
                            updateProducto(idx, {
                              cantidad_tm: tm,
                              cantidad_kg: kgPorUnidadDesdeTm(tm),
                            })
                          }}
                        />
                      </Field>
                      <Field label="Unidades">
                        <Input
                          size="sm"
                          type="number"
                          value={prod.unidades ?? 0}
                          onChange={(e) =>
                            updateProducto(idx, {
                              unidades: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </Field>
                    </Flex>
                  </Box>
                ))}
              </Box>
            </VStack>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogActionTrigger asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogActionTrigger>
          <Button
            colorPalette="blue"
            loading={mutation.isPending}
            disabled={
              loading ||
              loteData?.edicion_realizada ||
              !(loteData?.numero_lote || numeroLote.trim()) ||
              idProveedores.length === 0
            }
            onClick={handleSubmit}
          >
            Guardar edición única
          </Button>
          <DialogCloseTrigger />
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}
