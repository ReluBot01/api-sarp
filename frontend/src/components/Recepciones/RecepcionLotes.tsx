import { Grid, GridItem, Heading, VStack } from "@chakra-ui/react"
import useAuth from "@/hooks/useAuth"
import RecepcionForm from "./RecepcionForm"
import ResumenPanel from "./ResumenPanel"
import LotesList from "./LotesList"

const RecepcionLotes = () => {
  const { user } = useAuth()

  return (
    <VStack align="stretch" gap={4} w="full">
      <Heading size="xl">Recepción de Guias</Heading>
      <Grid templateColumns={{ base: "1fr", lg: "2fr 1fr" }} gap={6}>
        <GridItem>
          <RecepcionForm />
        </GridItem>
        <GridItem>
          <ResumenPanel user={user ?? undefined} />
        </GridItem>
      </Grid>
      <LotesList />
    </VStack>
  )
}

export default RecepcionLotes
