import { Card, Flex, SimpleGrid, Text, Icon } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { FiPackage, FiAlertTriangle, FiBox, FiTruck } from "react-icons/fi"
import { OpenAPI } from "@/client"
import { request as apiRequest } from "@/client/core/request"

const StatsCards = () => {
  // Query para stats de lotes
  const { data: lotesStats, isLoading: lotesLoading } = useQuery({
    queryFn: async () => {
      return await apiRequest(OpenAPI, {
        method: "GET",
        url: "/api/v1/lotes/stats",
      })
    },
    queryKey: ["lotes-stats"],
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  })

  // Query para stats de productos
  const { data: productosStats, isLoading: productosLoading } = useQuery({
    queryFn: async () => {
      return await apiRequest(OpenAPI, {
        method: "GET",
        url: "/api/v1/productos/stats",
      })
    },
    queryKey: ["productos-stats"],
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  })

  const isLoading = lotesLoading || productosLoading

  const statsData = [
    {
      title: "Guias Activas",
      value: lotesStats?.activos || 0,
      icon: FiPackage,
      color: "green",
    },
    {
      title: "Próximos a vencer",
      value: lotesStats?.proximos_a_vencer || 0,
      icon: FiAlertTriangle,
      color: "yellow",
    },
    {
      title: "Total Productos",
      value: productosStats?.total_productos || 0,
      icon: FiBox,
      color: "blue",
    },
    {
      title: "Proveedores",
      value: productosStats?.lotes_activos || 0,
      subtitle: "con guias activas",
      icon: FiTruck,
      color: "purple",
    },
  ]

  if (isLoading) {
    return (
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap={4} mb={6}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Card.Root key={index} p={4}>
            <Card.Body>
              <Flex align="center" justify="space-between" mb={2}>
                <Text fontSize="sm" color="fg.muted">
                  Cargando...
                </Text>
                <Icon as={FiPackage} fontSize="20px" color="fg.subtle" />
              </Flex>
              <Text fontSize="2xl" fontWeight="bold" color="fg.subtle">
                --
              </Text>
            </Card.Body>
          </Card.Root>
        ))}
      </SimpleGrid>
    )
  }

  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap={4} mb={6}>
      {statsData.map((stat, index) => (
        <Card.Root key={index} p={4}>
          <Card.Body>
            <Flex align="center" justify="space-between" mb={2}>
              <Text fontSize="sm" color="fg.muted">
                {stat.title}
              </Text>
              <Icon as={stat.icon} fontSize="20px" color={`${stat.color}.500`} />
            </Flex>
            <Text fontSize="2xl" fontWeight="bold" color={`${stat.color}.600`}>
              {stat.value}
            </Text>
          </Card.Body>
        </Card.Root>
      ))}
    </SimpleGrid>
  )
}

export default StatsCards
