import { Table, Text, Badge } from '@chakra-ui/react'
import type { ProductoPublic } from '@/client/ProductosService'

export default function ProductoRow({ producto }: { producto: ProductoPublic }) {
  const isCritical = producto.cantidad_disponible <= (producto.stock_minimo || 0)
  
  return (
    <Table.Row>
      <Table.Cell>
        <Text fontWeight="semibold">{producto.nombre}</Text>
      </Table.Cell>
      <Table.Cell>{producto.marca || "—"}</Table.Cell>
      <Table.Cell>
        {producto.peso_unitario 
          ? `${producto.peso_unitario} ${producto.unidad_peso || "kg"}`
          : "—"}
      </Table.Cell>
      <Table.Cell>
        <Badge colorPalette={isCritical ? "red" : "green"}>
          {producto.cantidad_disponible}
        </Badge>
      </Table.Cell>
      <Table.Cell>{producto.stock_minimo || 0}</Table.Cell>
      <Table.Cell>{producto.numero_lote ?? producto.id_lote ?? '—'}</Table.Cell>
    </Table.Row>
  )
}
