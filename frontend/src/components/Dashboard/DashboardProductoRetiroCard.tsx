import { Badge, Box, Card, HStack, Text, VStack } from "@chakra-ui/react"

import type { ProductoPublic } from "@/client/ProductosService"
import { RetirarProductoAction } from "@/components/Productos/RetirarProductoAction"

function diasHastaVencimiento(fechaVencimiento: string | null | undefined): number | null {
  if (!fechaVencimiento) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const v = new Date(fechaVencimiento)
  v.setHours(0, 0, 0, 0)
  return Math.ceil((v.getTime() - hoy.getTime()) / 86_400_000)
}

type Props = {
  producto: ProductoPublic
}

export function DashboardProductoRetiroCard({ producto }: Props) {
  const dias = diasHastaVencimiento(producto.fecha_vencimiento)
  const esVencido = dias !== null && dias < 0

  return (
    <Card.Root variant="outline" size="sm">
      <Card.Body p={3} display="flex" flexDirection="column" gap={2}>
        <HStack justify="space-between" align="start" gap={2}>
          <Text fontSize="xs" fontWeight="semibold" lineClamp={2} flex={1} minW={0}>
            {producto.nombre}
          </Text>
          <Badge
            size="sm"
            colorPalette={esVencido ? "red" : "orange"}
            variant="subtle"
            flexShrink={0}
            fontSize="10px"
          >
            {esVencido ? "Vencido" : dias !== null ? `${dias} d` : "—"}
          </Badge>
        </HStack>

        <Badge colorPalette="blue" variant="subtle" size="xs" width="fit-content" fontSize="10px">
          {producto.categoria}
        </Badge>

        <VStack align="stretch" gap={0}>
          <Text fontSize="10px" color="fg.muted" lineHeight="tall">
            <Box as="span" fontWeight="medium" color="fg">
              Vence:{" "}
            </Box>
            {producto.fecha_vencimiento
              ? new Date(producto.fecha_vencimiento).toLocaleDateString("es-ES")
              : "—"}
          </Text>
          <Text
            fontSize="10px"
            color="fg.muted"
            lineClamp={1}
            title={producto.proveedor_nombre ?? ""}
          >
            <Box as="span" fontWeight="medium" color="fg">
              Prov.:{" "}
            </Box>
            {producto.proveedor_nombre ?? "—"}
          </Text>
          <Text fontSize="10px" color="fg.muted" lineClamp={1}>
            <Box as="span" fontWeight="medium" color="fg">
              Guía:{" "}
            </Box>
            {producto.numero_lote ?? "—"}
          </Text>
          <Text fontSize="10px" color="fg.muted">
            <Box as="span" fontWeight="medium" color="fg">
              Und.:{" "}
            </Box>
            {producto.unidades}
          </Text>
        </VStack>

        <Box pt={1} mt="auto">
          <RetirarProductoAction
            idProducto={producto.id_producto}
            nombre={producto.nombre}
            canRetirar
            isRetirado={false}
            fullWidth
          />
        </Box>
      </Card.Body>
    </Card.Root>
  )
}
