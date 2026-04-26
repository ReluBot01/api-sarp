import { Button, HStack, NativeSelect, VStack, Textarea, Text, Box, IconButton } from "@chakra-ui/react"
import { FiArrowDown, FiArrowUp, FiTrash2 } from "react-icons/fi"
import { FormProvider, useForm } from "react-hook-form"
import { Field } from "../ui/field"
/** Peso por unidad: TM, kg, gr (gr solo en UI) y cálculo de línea — ver ProductosTable */
import ProductosTable from "./ProductosTable"
import { useRecepciones, type RecepcionLotePayload } from "@/hooks/useRecepciones"
import { useQuery } from "@tanstack/react-query"
import { OpenAPI } from "@/client"
import { request as apiRequest } from "@/client/core/request"
import useCustomToast from "@/hooks/useCustomToast"
import { sanitizeProductoData, sanitizeUpperString } from "@/utils"

type FormValues = RecepcionLotePayload

const RecepcionForm = () => {
  const methods = useForm<FormValues>({
    defaultValues: {
      lote: {
        numero_lote: null,
        id_proveedores: [] as number[],
        peso_total_recibido: 0,
        unidad_peso: "kg",
        observaciones: "",
      },
      productos: [],
    },
    mode: "onBlur",
  })

  const { showErrorToast } = useCustomToast()
  const { recepcionMutation, categorias, usosRecomendados, condiciones } = useRecepciones()

  const proveedoresQuery = useQuery<{ data: Array<{ id_proveedor: number; nombre: string }>; count: number }>({
    queryKey: ["proveedores"],
    queryFn: () => apiRequest(OpenAPI, { method: "GET", url: "/api/v1/proveedores/", query: { skip: 0, limit: 200 } }),
  })

  const listaProv = proveedoresQuery.data?.data ?? []
  const nombrePorId = Object.fromEntries(listaProv.map((p) => [p.id_proveedor, p.nombre]))
  const idProveedores = methods.watch("lote.id_proveedores") ?? []

  const agregarProveedor = (id: number) => {
    if (!id || idProveedores.includes(id)) return
    methods.setValue("lote.id_proveedores", [...idProveedores, id], { shouldDirty: true })
  }

  const quitarProveedor = (index: number) => {
    const next = idProveedores.filter((_, i) => i !== index)
    methods.setValue("lote.id_proveedores", next, { shouldDirty: true })
  }

  const moverProveedor = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= idProveedores.length) return
    const next = [...idProveedores]
    ;[next[index], next[j]] = [next[j], next[index]]
    methods.setValue("lote.id_proveedores", next, { shouldDirty: true })
  }

  const onSubmit = (data: FormValues) => {
    // Validar que haya al menos un producto
    if (!data.productos || data.productos.length === 0) {
      showErrorToast("Debe agregar al menos un producto")
      return
    }

    const idsProv = [...(data.lote.id_proveedores ?? [])].filter((id, i, arr) => id > 0 && arr.indexOf(id) === i)
    if (idsProv.length === 0) {
      showErrorToast("Debe agregar al menos un proveedor a la guía")
      return
    }

    // Sanitizar datos antes de enviar
    const payload: RecepcionLotePayload = {
      lote: {
        ...data.lote,
        id_proveedores: idsProv,
        id_proveedor: idsProv[0],
        peso_total_recibido: Number(data.lote.peso_total_recibido) || 0,
        observaciones: sanitizeUpperString(data.lote.observaciones) || null,
      },
      productos: data.productos.map((item) => {
        // Sanitizar cada producto
        const sanitized = sanitizeProductoData({
          ...item,
          cantidad_tm: Number(item.cantidad_tm) || 0,
          cantidad_kg: Number(item.cantidad_kg) || 0,
          unidades: Number(item.unidades) || 0,
          stock_minimo: Number(item.stock_minimo) || 0,
          categoria: item.categoria || "Otros",
          uso_recomendado: item.uso_recomendado || "PC DIRECTO HUMANO (PCDH)",
          condicion: item.condicion || "OPTIMAS CONDICIONES",
          estado_calidad: item.estado_calidad || "Aprobado",
          apto_consumo: item.apto_consumo !== false,
        })
        
        // Normalizar fechas y lote_producto a null si están vacías
        return {
          ...sanitized,
          lote_producto: sanitized.lote_producto || null,
          fecha_elaboracion: sanitized.fecha_elaboracion || null,
          fecha_vencimiento: sanitized.fecha_vencimiento || null,
        }
      }),
    }

    recepcionMutation.mutate(payload, {
      onSuccess: () => {
        methods.reset()
      },
      onError: (error: any) => {
        if (error?.body?.detail) {
          const detail = error.body.detail
          if (Array.isArray(detail)) {
            const messages = detail.map((d: any) => `${d.loc?.join(".")}: ${d.msg}`).join(", ")
            showErrorToast(`Error de validación: ${messages}`)
          } else if (typeof detail === "string") {
            showErrorToast(detail)
          } else {
            showErrorToast("Error al procesar la recepción")
          }
        } else {
          showErrorToast("Error al procesar la recepción")
        }
      },
    })
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <VStack gap={4} align="stretch" p={4} borderWidth="1px" borderRadius="md">
          <Box
            bg="bg.muted"
            borderWidth="1px"
            borderColor="border.subtle"
            borderLeftWidth="4px"
            borderLeftColor="blue.500"
            p={3}
            borderRadius="md"
          >
            <Text fontWeight="bold" color="fg">
              Información de la Guia (Llegada de Carga)
            </Text>
            <Text fontSize="sm" color="fg.muted">
              Registra los datos de la carga que llega al almacén
            </Text>
          </Box>

          <Field
            label="Proveedores de la guía *"
            helperText="El primero es el proveedor principal (prefijo de guía). Use las flechas para cambiar el orden."
          >
            <VStack align="stretch" gap={2}>
              <NativeSelect.Root width="100%">
                <NativeSelect.Field
                  value=""
                  aria-label="Agregar otro proveedor a la lista"
                  onChange={(e) => {
                    const v = Number(e.currentTarget.value)
                    if (v) agregarProveedor(v)
                    e.currentTarget.value = ""
                  }}
                >
                  <option value="">Agregar proveedor…</option>
                  {listaProv
                    .filter((p) => !idProveedores.includes(p.id_proveedor))
                    .map((p) => (
                      <option key={p.id_proveedor} value={p.id_proveedor}>
                        {p.nombre}
                      </option>
                    ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>

              {idProveedores.length === 0 ? (
                <Text fontSize="sm" color="fg.muted">
                  No hay proveedores en la lista.
                </Text>
              ) : (
                <VStack align="stretch" gap={1}>
                  {idProveedores.map((id, index) => (
                    <HStack
                      key={`${id}-${index}`}
                      justify="space-between"
                      py={1}
                      px={2}
                      borderWidth="1px"
                      borderRadius="md"
                      borderColor="border.subtle"
                      bg="bg.subtle"
                    >
                      <Text fontSize="sm">
                        <Text as="span" fontWeight="semibold" color="blue.600">
                          {index + 1}.
                        </Text>{" "}
                        {nombrePorId[id] ?? `ID ${id}`}
                        {index === 0 ? (
                          <Text as="span" fontSize="xs" color="fg.muted" ml={2}>
                            (principal)
                          </Text>
                        ) : null}
                      </Text>
                      <HStack gap={0}>
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
                      </HStack>
                    </HStack>
                  ))}
                </VStack>
              )}
            </VStack>
          </Field>

          <Field label="Observaciones de la Guia">
            <Textarea
              rows={2}
              {...methods.register("lote.observaciones")}
              placeholder="Observaciones sobre la llegada de la carga..."
            />
          </Field>

          <Box
            bg="bg.muted"
            borderWidth="1px"
            borderColor="border.subtle"
            borderLeftWidth="4px"
            borderLeftColor="green.500"
            p={3}
            borderRadius="md"
            mt={4}
          >
            <Text fontWeight="bold" color="fg">
              Productos de la Carga
            </Text>
            <Text fontSize="sm" color="fg.muted">
              Agrega los productos según el formato de la ficha de recepción
            </Text>
          </Box>

          <ProductosTable 
            categorias={categorias} 
            usosRecomendados={usosRecomendados}
            condiciones={condiciones}
          />

          <HStack gap={3} justify="flex-start" mt={4}>
            <Button type="submit" colorPalette="blue" loading={recepcionMutation.isPending}>
              Registrar Guia
            </Button>
            <Button
              variant="subtle"
              onClick={() => methods.reset()}
            >
              Limpiar
            </Button>
          </HStack>
        </VStack>
      </form>
    </FormProvider>
  )
}

export default RecepcionForm