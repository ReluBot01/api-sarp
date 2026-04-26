import {
  Button,
  Grid,
  GridItem,
  Input,
  VStack,
  Text,
  Badge,
  Box,
  HStack,
  Card,
  IconButton,
  NativeSelect,
} from "@chakra-ui/react"
import { useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { useQuery } from "@tanstack/react-query"
import { FaPlus, FaTrash, FaChevronDown, FaChevronUp } from "react-icons/fa"
import { Field } from "../ui/field"
import { CATEGORIAS_PRODUCTO, USOS_RECOMENDADOS, CONDICIONES_PRODUCTO } from "@/hooks/useRecepciones"
import { FabricantesService, type FabricantePublic } from "@/client/FabricantesService"
import { useState, useEffect } from "react"
import {
  pesoLineaKg,
  pesoTotalLoteKgDesdeProductos,
  kgPorUnidadDesdeTm,
  tmPorUnidadDesdeKg,
  gramosPorUnidadDesdeKg,
  kgPorUnidadDesdeGramos,
} from "@/utils/pesoRecepcion"
import { sanitizeUpperString } from "@/utils"

type ProductoItem = {
  nombre: string
  categoria: string
  id_fabricante?: number | null
  elaborado_por?: string | null
  marca?: string | null
  presentacion?: string | null
  lote_producto?: string | null
  fecha_elaboracion?: string | null
  fecha_vencimiento?: string | null
  uso_recomendado: string
  condicion: string
  cantidad_tm: number
  cantidad_kg: number
  unidades: number
  peso_unitario?: number
  estado_calidad: string
  apto_consumo: boolean
  motivo_rechazo?: string | null
  stock_minimo?: number
}

type FormValues = {
  lote: {
    peso_total_recibido: number
    unidad_peso: string
  }
  productos: ProductoItem[]
}

const defaultRow: ProductoItem = {
  nombre: "",
  categoria: "Otros",
  id_fabricante: null,
  elaborado_por: "",
  marca: "",
  presentacion: "",
  lote_producto: "",
  fecha_elaboracion: "",
  fecha_vencimiento: "",
  uso_recomendado: "PC DIRECTO HUMANO (PCDH)",
  condicion: "OPTIMAS CONDICIONES",
  cantidad_tm: 0,
  cantidad_kg: 0,
  unidades: 0,
  peso_unitario: 0,
  estado_calidad: "Aprobado",
  apto_consumo: true,
  motivo_rechazo: null,
  stock_minimo: 0,
}

type Props = {
  categorias?: string[]
  usosRecomendados?: string[]
  condiciones?: string[]
}

// Componente para un producto individual con campos en filas
const ProductoCard = ({ 
  index, 
  onRemove, 
  categorias, 
  usosRecomendados, 
  condiciones,
  fabricantes,
}: { 
  index: number
  onRemove: () => void
  categorias: string[]
  usosRecomendados: string[]
  condiciones: string[]
  fabricantes: FabricantePublic[]
}) => {
  const { register, setValue, watch } = useFormContext<FormValues>()
  const [isExpanded, setIsExpanded] = useState(true)
  
  // Watch para conversiones automáticas (kg/tm = **por unidad**)
  const cantidadTm = watch(`productos.${index}.cantidad_tm`)
  const cantidadKg = watch(`productos.${index}.cantidad_kg`)
  const unidades = watch(`productos.${index}.unidades`)

  const pesoLineaProducto = pesoLineaKg(cantidadKg, unidades)

  const gramosPorUnidad = gramosPorUnidadDesdeKg(cantidadKg ?? 0)

  // Conversión TM → Kg por unidad
  const handleTmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tm = parseFloat(e.target.value) || 0
    const kg = kgPorUnidadDesdeTm(tm)
    setValue(`productos.${index}.cantidad_tm`, tm)
    setValue(`productos.${index}.cantidad_kg`, kg)
    setValue(`productos.${index}.peso_unitario`, kg)
  }

  // Conversión Kg → TM por unidad
  const handleKgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const kg = parseFloat(e.target.value) || 0
    setValue(`productos.${index}.cantidad_kg`, kg)
    setValue(`productos.${index}.cantidad_tm`, tmPorUnidadDesdeKg(kg))
    setValue(`productos.${index}.peso_unitario`, kg)
  }

  // Gramos/unidad → kg y TM (la API solo guarda cantidad_kg y cantidad_tm)
  const handleGramosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const gr = parseFloat(e.target.value) || 0
    const kg = kgPorUnidadDesdeGramos(gr)
    setValue(`productos.${index}.cantidad_kg`, kg)
    setValue(`productos.${index}.cantidad_tm`, tmPorUnidadDesdeKg(kg))
    setValue(`productos.${index}.peso_unitario`, kg)
  }

  const handleUnidadesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const units = parseInt(e.target.value, 10) || 0
    setValue(`productos.${index}.unidades`, units)
  }

  return (
    <Card.Root mb={4} borderWidth="1px" borderColor="border.subtle">
      <Card.Header p={3} bg="bg.muted" cursor="pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <HStack justify="space-between">
          <HStack>
            <Badge colorPalette="blue" size="sm">#{index + 1}</Badge>
            <Text fontWeight="medium" fontSize="sm">
              {watch(`productos.${index}.nombre`) || "Nuevo Producto"}
            </Text>
            {watch(`productos.${index}.categoria`) && (
              <Badge colorPalette="green" size="sm">{watch(`productos.${index}.categoria`)}</Badge>
            )}
          </HStack>
          <HStack>
            <Text fontSize="xs" color="fg.muted">
              {pesoLineaProducto.toFixed(2)} kg línea ({(cantidadKg || 0).toFixed(2)} kg/un × {unidades || 0} und)
            </Text>
            <IconButton
              aria-label="toggle"
              variant="ghost"
              size="xs"
              onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded) }}
            >
              {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
            </IconButton>
            <IconButton
              aria-label="remove"
              colorPalette="red"
              variant="ghost"
              size="xs"
              onClick={(e) => { e.stopPropagation(); onRemove() }}
            >
              <FaTrash />
            </IconButton>
          </HStack>
        </HStack>
      </Card.Header>
      
      {isExpanded && (
        <Card.Body p={4}>
          {/* Fila 1: Información básica */}
          <Grid templateColumns="repeat(4, 1fr)" gap={3} mb={4}>
            <GridItem>
              <Field label="Producto" required>
                <Input
                  size="sm"
                  {...register(`productos.${index}.nombre` as const, { 
                    required: true,
                    onChange: (e) => {
                      // No hacer trim mientras escribe (para no romper espacios internos/cursor).
                      // Solo pasamos a MAYÚSCULAS; el trim se hará al guardar.
                      setValue(`productos.${index}.nombre`, (e.target.value || "").toUpperCase())
                    },
                    onBlur: (e) => {
                      const upperTrimmed = sanitizeUpperString(e.target.value) || ""
                      setValue(`productos.${index}.nombre`, upperTrimmed)
                    }
                  })}
                  placeholder="Nombre del producto"
                />
              </Field>
            </GridItem>
            <GridItem>
              <Field label="Categoría" required>
                <NativeSelect.Root size="sm" width="100%">
                  <NativeSelect.Field {...register(`productos.${index}.categoria` as const)}>
                    {categorias.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field>
            </GridItem>
            <GridItem>
              <Field label="Fabricante" required>
                <NativeSelect.Root size="sm" width="100%">
                  <NativeSelect.Field
                    {...register(`productos.${index}.id_fabricante` as const, {
                      setValueAs: (v) => (v === "" ? null : Number(v)),
                      onChange: (e) => {
                        const selectedId = e.target.value
                        if (selectedId) {
                          const fab = fabricantes.find((f) => f.id_fabricante === Number(selectedId))
                          if (fab) {
                            setValue(`productos.${index}.elaborado_por`, fab.nombre)
                          }
                        } else {
                          setValue(`productos.${index}.elaborado_por`, "")
                        }
                      },
                    })}
                  >
                    <option value="">-- Seleccionar Fabricante --</option>
                    {fabricantes.map((fab) => (
                      <option key={fab.id_fabricante} value={fab.id_fabricante}>
                        {fab.nombre}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field>
            </GridItem>
            <GridItem>
              <Field label="Marca">
                <Input
                  size="sm"
                  {...register(`productos.${index}.marca` as const, {
                    onChange: (e) => {
                      setValue(`productos.${index}.marca`, (e.target.value || "").toUpperCase() || null)
                    },
                    onBlur: (e) => {
                      const upperTrimmed = sanitizeUpperString(e.target.value)
                      setValue(`productos.${index}.marca`, upperTrimmed || null)
                    }
                  })}
                  placeholder="Marca"
                />
              </Field>
            </GridItem>
          </Grid>

          {/* Fila 2: Presentación y Guia */}
          <Grid templateColumns="repeat(4, 1fr)" gap={3} mb={4}>
            <GridItem>
              <Field label="Presentación">
                <Input
                  size="sm"
                  {...register(`productos.${index}.presentacion` as const, {
                    onChange: (e) => {
                      setValue(`productos.${index}.presentacion`, (e.target.value || "").toUpperCase() || null)
                    },
                    onBlur: (e) => {
                      const upperTrimmed = sanitizeUpperString(e.target.value)
                      setValue(`productos.${index}.presentacion`, upperTrimmed || null)
                    }
                  })}
                  placeholder="Ej: BULTOS 900 GR X 20 UND"
                />
              </Field>
            </GridItem>
            <GridItem>
              <Field label="Lote del producto">
                <Input
                  size="sm"
                  {...register(`productos.${index}.lote_producto` as const, {
                    onBlur: (e) => {
                      const trimmed = sanitizeUpperString(e.target.value) || ""
                      // Si está vacío después de trim, establecer como null (se mostrará como "S/L")
                      setValue(`productos.${index}.lote_producto`, trimmed || null)
                    }
                  })}
                  placeholder="S/L si no tiene"
                />
              </Field>
            </GridItem>
            <GridItem>
              <Field label="Fecha Elaboración">
                <Input
                  size="sm"
                  type="date"
                  {...register(`productos.${index}.fecha_elaboracion` as const, {
                    onBlur: (e) => {
                      // Si está vacío, establecer como null (se mostrará como "S/F")
                      if (!e.target.value) {
                        setValue(`productos.${index}.fecha_elaboracion`, null)
                      }
                    }
                  })}
                />
              </Field>
            </GridItem>
            <GridItem>
              <Field label="Fecha Vencimiento">
                <Input
                  size="sm"
                  type="date"
                  {...register(`productos.${index}.fecha_vencimiento` as const, {
                    onBlur: (e) => {
                      // Si está vacío, establecer como null (se mostrará como "S/F")
                      if (!e.target.value) {
                        setValue(`productos.${index}.fecha_vencimiento`, null)
                      }
                    }
                  })}
                />
              </Field>
            </GridItem>
          </Grid>

          {/* Fila 3: Uso y Condición */}
          <Grid templateColumns="repeat(4, 1fr)" gap={3} mb={4}>
            <GridItem>
              <Field label="Uso Recomendado">
                <NativeSelect.Root size="sm" width="100%">
                  <NativeSelect.Field {...register(`productos.${index}.uso_recomendado` as const)}>
                    {usosRecomendados.map((uso) => (
                      <option key={uso} value={uso}>
                        {uso}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field>
            </GridItem>
            <GridItem>
              <Field label="Condición">
                <NativeSelect.Root size="sm" width="100%">
                  <NativeSelect.Field {...register(`productos.${index}.condicion` as const)}>
                    {condiciones.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field>
            </GridItem>   
          </Grid>

          {/* Fila 4: Cantidades con conversión automática */}
          <Box
            bg="bg.muted"
            borderWidth="1px"
            borderColor="border.subtle"
            borderLeftWidth="4px"
            borderLeftColor="blue.500"
            p={3}
            borderRadius="md"
            mb={2}
          >
            <Text fontSize="xs" color="fg.muted" mb={2}>
              El lote suma (kg/unidad × unidades).
            </Text>
            <Grid
              templateColumns={{
                base: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
                xl: "repeat(5, 1fr)",
              }}
              gap={3}
            >
              <GridItem>
                <Field label="TM por unidad">
                  <Input
                    size="sm"
                    type="number"
                    step="0.0001"
                    value={cantidadTm || ""}
                    onChange={handleTmChange}
                    placeholder="0.0000 TM"
                  />
                </Field>
              </GridItem>
              <GridItem>
                <Field label="Kg por unidad">
                  <Input
                    size="sm"
                    type="number"
                    step="0.01"
                    value={cantidadKg || ""}
                    onChange={handleKgChange}
                    placeholder="0.00 Kg"
                  />
                </Field>
              </GridItem>
              <GridItem>
                <Field label="Gramos por unidad">
                  <Input
                    size="sm"
                    type="number"
                    value={gramosPorUnidad || ""}
                    onChange={handleGramosChange}
                    placeholder="0.00 Gr"
                    title="Equivale a kg/unidad × 1000; se guarda como cantidad_kg en el servidor"
                  />
                </Field>
              </GridItem>
              <GridItem>  
                <Field label="Unidades">
                  <Input
                    size="sm"
                    type="number"
                    value={unidades || ""}
                    onChange={handleUnidadesChange}
                    placeholder="0"
                  />
                </Field>
              </GridItem>
              <GridItem>
                <Field label="Peso total (kg)">
                  <Input
                    size="sm"
                    type="text"
                    value={pesoLineaProducto.toFixed(2)}
                    readOnly
                    bg="bg.muted"
                    fontWeight="bold"
                    color="blue.solid"
                    title="kg/unidad × unidades"
                  />
                </Field>
              </GridItem>
            </Grid>
          </Box>
        </Card.Body>
      )}
    </Card.Root>
  )
}

const ProductosTable = ({ 
  categorias = CATEGORIAS_PRODUCTO, 
  usosRecomendados = USOS_RECOMENDADOS,
  condiciones = CONDICIONES_PRODUCTO 
}: Props) => {
  const { control, setValue } = useFormContext<FormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: "productos" })
  
  // Query para obtener fabricantes activos
  const { data: fabricantesData } = useQuery({
    queryKey: ["fabricantes", "activos"],
    queryFn: () => FabricantesService.readFabricantesActivos({}),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })
  const fabricantes = fabricantesData?.data ?? []
  
  // Watch todos los productos para calcular el peso total
  const productos = useWatch({ control, name: "productos" })
  const listaProductos = productos ?? []
  const pesoTotalKgResumen =
    fields.length > 0 ? pesoTotalLoteKgDesdeProductos(listaProductos) : 0
  const pesoTotalTmResumen = pesoTotalKgResumen / 1000
  const totalUnidadesResumen = listaProductos.reduce(
    (sum, p) => sum + (Number(p?.unidades) || 0),
    0,
  )

  // Calcular peso total automáticamente cuando cambien los productos
  useEffect(() => {
    if (productos && productos.length > 0) {
      const pesoTotalKg = pesoTotalLoteKgDesdeProductos(productos)
      setValue("lote.peso_total_recibido", pesoTotalKg)
      setValue("lote.unidad_peso", "kg")
    } else {
      setValue("lote.peso_total_recibido", 0)
    }
  }, [productos, setValue])

  return (
    <VStack gap={4} align="stretch">
      {fields.length === 0 && (
        <VStack p={8} borderWidth="1px" borderRadius="md" bg="bg.muted" borderStyle="dashed">
          <Text color="fg.muted">No hay productos agregados. Haz clic en "Añadir producto" para comenzar.</Text>
        </VStack>
      )}
      
      {fields.map((field, index) => (
        <ProductoCard
          key={field.id}
          index={index}
          onRemove={() => remove(index)}
          categorias={categorias}
          usosRecomendados={usosRecomendados}
          condiciones={condiciones}
          fabricantes={fabricantes}
        />
      ))}
      
      {/* Resumen: mismo criterio que lote.peso_total_recibido (Σ kg/unidad × unidades por línea) */}
      {fields.length > 0 && (
        <Box
          p={3}
          borderRadius="md"
          bg="bg.muted"
          borderWidth="1px"
          borderColor="border.subtle"
          borderLeftWidth="4px"
          borderLeftColor="green.500"
        >
      
          <Grid templateColumns="repeat(4, 1fr)" gap={4}>
            <GridItem>
              <Text fontSize="xs" color="fg.muted">
                Total productos
              </Text>
              <Text fontSize="lg" fontWeight="bold" color="green.solid">
                {fields.length}
              </Text>
            </GridItem>
            <GridItem>
              <Text fontSize="xs" color="fg.muted">
                Peso total (TM)
              </Text>
              <Text fontSize="lg" fontWeight="bold" color="green.solid">
                {pesoTotalTmResumen.toFixed(4)}
              </Text>
            </GridItem>
            <GridItem>
              <Text fontSize="xs" color="fg.muted">
                Peso total (kg)
              </Text>
              <Text fontSize="lg" fontWeight="bold" color="green.solid">
                {pesoTotalKgResumen.toFixed(2)}
              </Text>
            </GridItem>
            <GridItem>
              <Text fontSize="xs" color="fg.muted">
                Total unidades
              </Text>
              <Text fontSize="lg" fontWeight="bold" color="green.solid">
                {totalUnidadesResumen}
              </Text>
            </GridItem>
          </Grid>
        </Box>
      )}
      
      <Button onClick={() => append(defaultRow)} variant="outline" colorPalette="green">
        <FaPlus style={{ marginRight: '0.5em' }} />
        Añadir producto
      </Button>
    </VStack>
  )
}

export default ProductosTable
