import { Box, Heading, Stack, Text, VStack } from "@chakra-ui/react"

type Props = {
  user?: { full_name?: string | null }
}

const ResumenPanel = ({ user }: Props) => {
  const today = new Date()
  const fecha = today.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  
  return (
    <VStack align="stretch" gap={4}>
      <Box p={4} borderWidth="1px" borderRadius="md" bg="bg.surface">
        <Heading size="lg" mb={4}>Resumen de Recepción</Heading>
        <Stack gap={2}>
          <Text>
            <b>Fecha:</b> {fecha}
          </Text>
          <Text>
            <b>Usuario:</b> {user?.full_name ?? "Sistema"}
          </Text>
        </Stack>
      </Box>
    </VStack>
  )
}

export default ResumenPanel
