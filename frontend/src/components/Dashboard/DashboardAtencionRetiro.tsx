import { Box, Flex, Heading, Icon, SimpleGrid, Skeleton, Text } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { FiZap } from "react-icons/fi"

import { ProductosService } from "@/client/ProductosService"

import { DashboardProductoRetiroCard } from "./DashboardProductoRetiroCard"

export function DashboardAtencionRetiro() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["productos", "pendientes-retiro"],
    queryFn: () => ProductosService.readPendientesRetiro({ limit: 24 }),
    refetchOnWindowFocus: true,
    refetchInterval: 90_000,
    retry: 1,
  })

  const items = data?.data ?? []

  if (isPending) {
    return (
      <Box>
        <Skeleton height="24px" width="280px" mb={3} />
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} gap={3}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height="160px" borderRadius="md" />
          ))}
        </SimpleGrid>
      </Box>
    )
  }

  if (isError) {
    return (
      <Box>
        <Heading size="md" mb={2}>
          <Flex align="center" gap={2}>
            <Icon as={FiZap} />
            Retiro rápido
          </Flex>
        </Heading>
        <Text fontSize="sm" color="red.600">
          No se pudo cargar la lista de retiro rápido. Recarga la página o revisa la consola del servidor.
        </Text>
      </Box>
    )
  }

  if (items.length === 0) {
    return (
      <Box>
        <Heading size="md" mb={2}>
          <Flex align="center" gap={2}>
            <Icon as={FiZap} />
            Retiro rápido
          </Flex>
        </Heading>
        <Text fontSize="sm" color="fg.muted">
          No hay productos vencidos ni dentro del periodo de alerta por vencimiento pendientes de
          gestión.
        </Text>
      </Box>
    )
  }

  return (
    <Box>
      <Heading size="md" mb={1}>
        <Flex align="center" gap={2}>
          <Icon as={FiZap} />
          Retiro rápido
        </Flex>
      </Heading>
      <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} gap={3}>
        {items.map((p) => (
          <DashboardProductoRetiroCard key={p.id_producto} producto={p} />
        ))}
      </SimpleGrid>
    </Box>
  )
}
