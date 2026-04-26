import {
  Box,
  Flex,
  Heading,
  HStack,
  Skeleton,
  Stack,
  Table,
  Text,
  VStack,
} from "@chakra-ui/react"

import type { LotePublic, LotesPublic } from "@/client"
import { EliminarGuiaConfirmButton } from "@/components/Lotes/GuiaConfirmActions"
import useAuth from "@/hooks/useAuth"
import { useRecepciones } from "@/hooks/useRecepciones"

const LotesList = () => {
  const { lotesQuery } = useRecepciones()
  const { isAdmin } = useAuth()

  if (lotesQuery.isLoading) {
    return (
      <Stack gap={2}>
        <Skeleton height="40px" />
        <Skeleton height="200px" />
      </Stack>
    )
  }

  const data = lotesQuery.data as LotesPublic | undefined
  const lotes: LotePublic[] = data?.data || []
  const count = data?.count || 0

  return (
    <Box p={4} borderWidth="1px" borderRadius="md" bg="bg.surface">
      <VStack align="stretch" gap={4}>
        <HStack justify="space-between">
          <Heading size="md">Guias Recientes</Heading>
          <Text color="fg.muted" fontSize="sm">
            {count} {count === 1 ? "guia" : "guias"}
          </Text>
        </HStack>

        {lotes.length === 0 ? (
          <Text color="fg.muted" textAlign="center" py={8}>
            No hay guias registradas
          </Text>
        ) : (
          <Box overflowX="auto">
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Número de Guia</Table.ColumnHeader>
                  <Table.ColumnHeader>Fecha Llegada</Table.ColumnHeader>
                  <Table.ColumnHeader>Estado Calidad</Table.ColumnHeader>
                  {isAdmin ? <Table.ColumnHeader>Acciones</Table.ColumnHeader> : null}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {lotes.slice(0, 10).map((lote: LotePublic) => (
                  <Table.Row key={lote.id_lote}>
                    <Table.Cell>
                      <Text fontWeight="medium" fontSize="sm">
                        {lote.numero_lote}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontSize="sm" color="fg.muted">
                        {lote.fecha_llegada
                          ? new Date(lote.fecha_llegada).toLocaleDateString("es-ES")
                          : "-"}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text
                        fontSize="sm"
                        color={
                          String(lote.estado_calidad || "").toLowerCase() === "aprobado"
                            ? "green.500"
                            : String(lote.estado_calidad || "").toLowerCase() === "rechazado"
                              ? "red.500"
                              : "yellow.500"
                        }
                      >
                        {lote.estado_calidad || "Pendiente"}
                      </Text>
                    </Table.Cell>
                    {isAdmin ? (
                      <Table.Cell>
                        <Flex gap={2} align="center" flexWrap="wrap">
                          <EliminarGuiaConfirmButton idLote={lote.id_lote} numeroGuia={lote.numero_lote} />
                        </Flex>
                      </Table.Cell>
                    ) : null}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </VStack>
    </Box>
  )
}

export default LotesList
