import { Box, Container, Heading, Text, VStack, SimpleGrid, Card, Flex, Icon } from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { OpenAPI } from "@/client"
import { request as apiRequest } from "@/client/core/request"
import type { LotesStats } from "@/client/LotesService"
import type { ProductosStats } from "@/client/ProductosService"
import { FiPackage, FiBox, FiAlertTriangle, FiTruck } from "react-icons/fi"

import { DashboardAtencionRetiro } from "@/components/Dashboard/DashboardAtencionRetiro"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
})

function Dashboard() {
  const { user: currentUser } = useAuth()

  const emptyLotesStats: LotesStats = {
    total_lotes: 0,
    activos: 0,
    cerrados: 0,
    peso_total_almacen: 0,
    unidad_peso: "kg",
  }

  const emptyProductosStats: ProductosStats = {
    total_productos: 0,
    stock_total: 0,
    productos_bajo_stock: 0,
    productos_sin_stock: 0,
    productos_por_vencer: 0,
    productos_vencidos: 0,
    lotes_activos: 0,
  }

  // Query para estadísticas de lotes
  const lotesStatsQuery = useQuery<LotesStats>({
    queryKey: ["lotes", "stats"],
    queryFn: () =>
      apiRequest(OpenAPI, {
        method: "GET",
        url: "/api/v1/lotes/stats",
      }),
  })

  // Query para estadísticas de productos
  const productosStatsQuery = useQuery<ProductosStats>({
    queryKey: ["productos", "stats"],
    queryFn: () =>
      apiRequest(OpenAPI, {
        method: "GET",
        url: "/api/v1/productos/stats",
      }),
  })

  const lotesStats = lotesStatsQuery.data ?? emptyLotesStats

  const productosStats = productosStatsQuery.data ?? emptyProductosStats

  return (
    <Container maxW="full">
      <VStack align="stretch" gap={6} pt={12} m={4}>
        {/* Saludo personalizado */}
        <Box>
          <Heading size="xl" mb={2}>
            Hola, {currentUser?.full_name || currentUser?.email}
          </Heading>
          <Text color="fg.muted">Sistema de Inventario de Almacén</Text>
        </Box>

        {/* Estadísticas principales */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap={4}>
          {/* Total Guias */}
          <Card.Root>
            <Card.Body>
              <Flex justify="space-between" align="center">
                <Box>
                  <Text fontSize="sm" color="fg.muted">Total Guias</Text>
                  <Text fontSize="2xl" fontWeight="bold">{lotesStats.total_lotes}</Text>
                  <Text fontSize="xs" color="green.500">{lotesStats.activos} activos</Text>
                </Box>
                <Icon as={FiPackage} boxSize={8} color="blue.500" />
              </Flex>
            </Card.Body>
          </Card.Root>

          {/* Total Productos */}
          <Card.Root>
            <Card.Body>
              <Flex justify="space-between" align="center">
                <Box>
                  <Text fontSize="sm" color="fg.muted">Total Productos</Text>
                  <Text fontSize="2xl" fontWeight="bold">{productosStats.total_productos}</Text>
                  <Text fontSize="xs" color="fg.muted">Stock: {productosStats.stock_total} unidades</Text>
                </Box>
                <Icon as={FiBox} boxSize={8} color="green.500" />
              </Flex>
            </Card.Body>
          </Card.Root>

          {/* Peso Total */}
          <Card.Root>
            <Card.Body>
              <Flex justify="space-between" align="center">
                <Box>
                  <Text fontSize="sm" color="fg.muted">Peso en Almacén</Text>
                  <Text fontSize="2xl" fontWeight="bold">
                    {lotesStats.peso_total_almacen.toLocaleString()} {lotesStats.unidad_peso}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">Guias activas</Text>
                </Box>
                <Icon as={FiTruck} boxSize={8} color="purple.500" />
              </Flex>
            </Card.Body>
          </Card.Root>

          {/* Alertas */}
          <Card.Root borderColor={productosStats.productos_por_vencer > 0 ? "orange.300" : undefined}>
            <Card.Body>
              <Flex justify="space-between" align="center">
                <Box>
                  <Text fontSize="sm" color="fg.muted">Alertas</Text>
                  <Text fontSize="2xl" fontWeight="bold" color={productosStats.productos_por_vencer > 0 ? "orange.500" : undefined}>
                    {productosStats.productos_por_vencer}
                  </Text>
                  <Text fontSize="xs" color="orange.500">Productos por vencer</Text>
                </Box>
                <Icon
                  as={FiAlertTriangle}
                  boxSize={8}
                  color={productosStats.productos_por_vencer > 0 ? "orange.500" : "fg.muted"}
                />
              </Flex>
            </Card.Body>
          </Card.Root>
        </SimpleGrid>

        

        {/* Productos con bajo stock */}
        {productosStats.productos_bajo_stock > 0 && (
          <Card.Root borderColor="red.300">
            <Card.Body>
              <Flex align="center" gap={2}>
                <Icon as={FiAlertTriangle} color="red.500" />
                <Text fontWeight="bold" color="red.500">
                  {productosStats.productos_bajo_stock} productos con bajo stock
                </Text>
              </Flex>
              <Text fontSize="sm" color="fg.muted" mt={1}>
                Revisa los productos que están por debajo del stock mínimo configurado.
              </Text>
            </Card.Body>
          </Card.Root>
        )}

        {/* Productos vencidos */}
        {productosStats.productos_vencidos > 0 && (
          <Card.Root borderColor="red.500" bg="bg.muted">
            <Card.Body>
              <Flex align="center" gap={2}>
                <Icon as={FiAlertTriangle} color="red.600" />
                <Text fontWeight="bold" color="red.600">
                  {productosStats.productos_vencidos} productos vencidos
                </Text>
              </Flex>
              <Text fontSize="sm" color="red.600" mt={1}>
                Hay productos que ya han superado su fecha de vencimiento y deben ser retirados.
              </Text>
            </Card.Body>
          </Card.Root>
        )}
        <DashboardAtencionRetiro />
      </VStack>
    </Container>
  )
}
