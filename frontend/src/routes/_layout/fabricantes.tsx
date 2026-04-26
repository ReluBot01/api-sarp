import {
  Badge,
  Box,
  Button,
  Container,
  EmptyState,
  Flex,
  Heading,
  HStack,
  Icon,
  Input,
  SimpleGrid,
  Table,
  Text,
  VStack,
  Card,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { FiEdit, FiLayers, FiPlus, FiSearch, FiTrash } from "react-icons/fi"
import { useState } from "react"
import { z } from "zod"

import { FabricantesService, type FabricantePublic } from "@/client/FabricantesService"
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination"
import {
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
  DialogActionTrigger,
} from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { sanitizeFabricanteData, sanitizeString } from "@/utils"
import RifInput from "@/components/ui/RifInput"

const fabricantesSearchSchema = z.object({
  page: z.number().catch(1),
  q: z.string().catch(""),
})

const PER_PAGE = 10

export const Route = createFileRoute("/_layout/fabricantes")({
  component: Fabricantes,
  validateSearch: (search) => fabricantesSearchSchema.parse(search),
})

function AddFabricanteDialog({ onSuccess }: { onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    nombre: "",
    rif: "",
    contacto: "",
    telefono: "",
    email: "",
    direccion: "",
  })
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const createMutation = useMutation({
    mutationFn: () => {
      const sanitized = sanitizeFabricanteData({
        ...formData,
        estado: true,
      })
      return FabricantesService.createFabricante({
        requestBody: sanitized,
      })
    },
    onSuccess: () => {
      showSuccessToast("Fabricante creado exitosamente")
      setIsOpen(false)
      setFormData({ nombre: "", rif: "", contacto: "", telefono: "", email: "", direccion: "" })
      onSuccess()
    },
    onError: (error: any) => {
      showErrorToast(error?.body?.detail || "Error al crear fabricante")
    },
  })

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => setIsOpen(e.open)}>
      <DialogTrigger asChild>
        <Button colorPalette="blue">
          <FiPlus style={{ marginRight: "0.5em" }} />
          Nuevo Fabricante
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar Fabricante</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <VStack gap={4}>
            <Field label="Nombre *" required>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Nombre del fabricante"
              />
            </Field>
            <Field label="RIF *" required>
              <RifInput
                value={formData.rif}
                onChange={(value) => setFormData({ ...formData, rif: value })}
                placeholder="J-12345678-9"
                size="md"
                required
              />
            </Field>
            <Field label="Persona de Contacto">
              <Input
                value={formData.contacto}
                onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                placeholder="Nombre del contacto"
              />
            </Field>
            <Field label="Teléfono">
              <Input
                type="tel"
                inputMode="numeric"
                value={formData.telefono}
                onChange={(e) => {
                  // Solo permitir números y máximo 11 caracteres
                  const numericValue = e.target.value.replace(/\D/g, "").slice(0, 11)
                  setFormData({ ...formData, telefono: numericValue })
                }}
                onBlur={(e) => {
                  const numericValue = e.target.value.replace(/\D/g, "").slice(0, 11)
                  setFormData({ ...formData, telefono: numericValue })
                }}
                placeholder="04121234567"
                maxLength={11}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contacto@empresa.com"
              />
            </Field>
            <Field label="Dirección">
              <Input
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                onBlur={(e) =>
                  setFormData({ ...formData, direccion: e.target.value.trim() })
                }
                placeholder="Dirección del fabricante"
              />
            </Field>
          </VStack>
        </DialogBody>
        <DialogFooter>
          <DialogActionTrigger asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogActionTrigger>
          <Button
            colorPalette="blue"
            onClick={() => createMutation.mutate()}
            loading={createMutation.isPending}
            disabled={!formData.nombre || !formData.rif}
          >
            Guardar
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  )
}

function EditFabricanteDialog({ fabricante, onSuccess }: { fabricante: FabricantePublic; onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    nombre: fabricante.nombre,
    rif: fabricante.rif,
    contacto: fabricante.contacto || "",
    telefono: fabricante.telefono || "",
    email: fabricante.email || "",
    direccion: fabricante.direccion || "",
  })
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const updateMutation = useMutation({
    mutationFn: () => {
      const sanitized = sanitizeFabricanteData(formData)
      return FabricantesService.updateFabricante({
        id: fabricante.id_fabricante,
        requestBody: sanitized,
      })
    },
    onSuccess: () => {
      showSuccessToast("Fabricante actualizado exitosamente")
      setIsOpen(false)
      onSuccess()
    },
    onError: (error: any) => {
      showErrorToast(error?.body?.detail || "Error al actualizar fabricante")
    },
  })

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => setIsOpen(e.open)}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="xs" colorPalette="blue">
          <FiEdit />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Fabricante</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <VStack gap={4}>
            <Field label="Nombre *" required>
              <Input
                value={formData.nombre}
                onChange={(e) => {
                  const trimmed = sanitizeString(e.target.value) || ""
                  setFormData({ ...formData, nombre: trimmed })
                }}
                onBlur={(e) => {
                  const trimmed = sanitizeString(e.target.value) || ""
                  setFormData({ ...formData, nombre: trimmed })
                }}
                placeholder="Nombre del fabricante"
              />
            </Field>
            <Field label="RIF *" required>
              <RifInput
                value={formData.rif}
                onChange={(value) => setFormData({ ...formData, rif: value })}
                placeholder="J-12345678-9"
                size="md"
                required
              />
            </Field>
            <Field label="Persona de Contacto">
              <Input
                value={formData.contacto}
                onChange={(e) => {
                  const trimmed = sanitizeString(e.target.value) || ""
                  setFormData({ ...formData, contacto: trimmed })
                }}
                onBlur={(e) => {
                  const trimmed = sanitizeString(e.target.value) || ""
                  setFormData({ ...formData, contacto: trimmed })
                }}
                placeholder="Nombre del contacto"
              />
            </Field>
            <Field label="Teléfono">
              <Input
                type="tel"
                inputMode="numeric"
                value={formData.telefono}
                onChange={(e) => {
                  // Solo permitir números y máximo 11 caracteres
                  const numericValue = e.target.value.replace(/\D/g, "").slice(0, 11)
                  setFormData({ ...formData, telefono: numericValue })
                }}
                onBlur={(e) => {
                  const numericValue = e.target.value.replace(/\D/g, "").slice(0, 11)
                  setFormData({ ...formData, telefono: numericValue })
                }}
                placeholder="04121234567"
                maxLength={11}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => {
                  const trimmed = sanitizeString(e.target.value) || ""
                  setFormData({ ...formData, email: trimmed })
                }}
                onBlur={(e) => {
                  const trimmed = sanitizeString(e.target.value) || ""
                  setFormData({ ...formData, email: trimmed })
                }}
                placeholder="contacto@empresa.com"
              />
            </Field>
            <Field label="Dirección">
              <Input
                value={formData.direccion}
                onChange={(e) =>
                  setFormData({ ...formData, direccion: e.target.value })
                }
                onBlur={(e) =>
                  setFormData({ ...formData, direccion: e.target.value.trim() })
                }
                placeholder="Dirección del fabricante"
              />
            </Field>
          </VStack>
        </DialogBody>
        <DialogFooter>
          <DialogActionTrigger asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogActionTrigger>
          <Button
            colorPalette="blue"
            onClick={() => updateMutation.mutate()}
            loading={updateMutation.isPending}
            disabled={!formData.nombre || !formData.rif}
          >
            Guardar
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  )
}

function DeleteFabricanteDialog({ fabricante, onSuccess }: { fabricante: FabricantePublic; onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const softDeleteMutation = useMutation({
    mutationFn: () => FabricantesService.deleteFabricante({ id: fabricante.id_fabricante }),
    onSuccess: () => {
      showSuccessToast("Fabricante eliminado (marcado como inactivo)")
      setIsOpen(false)
      onSuccess()
    },
    onError: (error: any) => {
      showErrorToast(error?.body?.detail || "Error al eliminar fabricante")
    },
  })

  const forceDeleteMutation = useMutation({
    mutationFn: () => FabricantesService.forceDeleteFabricante({ id: fabricante.id_fabricante }),
    onSuccess: () => {
      showSuccessToast("Fabricante eliminado definitivamente")
      setIsOpen(false)
      onSuccess()
    },
    onError: (error: any) => {
      showErrorToast(
        error?.body?.detail ||
          "Error al eliminar definitivamente el fabricante (verifica que no tenga productos asociados)"
      )
    },
  })

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => setIsOpen(e.open)}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="xs" colorPalette="red">
          <FiTrash />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar Fabricante</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <VStack align="flex-start" gap={3}>
            <Text>
              ¿Está seguro de que desea eliminar el fabricante{" "}
              <strong>{fabricante.nombre}</strong> (RIF: {fabricante.rif})?
            </Text>
            <Text mt={2} fontSize="sm" color="gray.500">
              - <strong>Eliminar (suave)</strong>: desactiva el fabricante (no aparecerá en selectores), pero se mantiene
              en el histórico.
            </Text>
            <Text mt={1} fontSize="sm" color="red.500">
              - <strong>Eliminar definitivamente</strong>: intenta borrar el fabricante de la base de datos. Solo se
              permitirá si no tiene productos asociados.
            </Text>
          </VStack>
        </DialogBody>
        <DialogFooter>
          <DialogActionTrigger asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogActionTrigger>
          <Button
            colorPalette="red"
            variant="outline"
            onClick={() => softDeleteMutation.mutate()}
            loading={softDeleteMutation.isPending}
          >
            Eliminar (suave)
          </Button>
          <Button
            colorPalette="red"
            onClick={() => forceDeleteMutation.mutate()}
            loading={forceDeleteMutation.isPending}
          >
            Eliminar definitivamente
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  )
}

function FabricantesTable() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { page, q } = Route.useSearch()
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const { data, isLoading } = useQuery({
    queryKey: ["fabricantes", { page, q }],
    queryFn: () =>
      FabricantesService.readFabricantes({
        skip: (page - 1) * PER_PAGE,
        limit: PER_PAGE,
        q: q || undefined,
      }),
    placeholderData: (prevData) => prevData,
  })

  const toggleEstadoMutation = useMutation({
    mutationFn: (id: number) => FabricantesService.toggleEstado({ id }),
    onSuccess: (data) => {
      showSuccessToast(data.message)
      queryClient.invalidateQueries({ queryKey: ["fabricantes"] })
    },
    onError: (error: any) => {
      showErrorToast(error?.body?.detail || "Error al cambiar estado")
    },
  })

  const setPage = (p: number) => {
    navigate({ to: "/fabricantes", search: (prev) => ({ ...prev, page: p }) })
  }

  const fabricantes = data?.data ?? []
  const count = data?.count ?? 0

  if (isLoading) {
    return <Text>Cargando...</Text>
  }

  if (fabricantes.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <FiSearch />
          </EmptyState.Indicator>
          <VStack textAlign="center">
            <EmptyState.Title>No se encontraron fabricantes</EmptyState.Title>
            <EmptyState.Description>
              {q ? "Intenta ajustar la búsqueda" : "Aún no hay fabricantes registrados"}
            </EmptyState.Description>
          </VStack>
        </EmptyState.Content>
      </EmptyState.Root>
    )
  }

  return (
    <>
      <Table.Root size={{ base: "sm", md: "md" }}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Nombre</Table.ColumnHeader>
            <Table.ColumnHeader>RIF</Table.ColumnHeader>
            <Table.ColumnHeader>Contacto</Table.ColumnHeader>
            <Table.ColumnHeader>Teléfono</Table.ColumnHeader>
            <Table.ColumnHeader>Email</Table.ColumnHeader>
            <Table.ColumnHeader>Estado</Table.ColumnHeader>
            {isAdmin ? <Table.ColumnHeader>Acciones</Table.ColumnHeader> : null}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {fabricantes.map((f: FabricantePublic) => (
            <Table.Row key={f.id_fabricante}>
              <Table.Cell>
                <Text fontWeight="medium">{f.nombre}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text fontSize="sm">{f.rif}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text fontSize="sm">{f.contacto || "—"}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text fontSize="sm">{f.telefono || "—"}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text fontSize="sm">{f.email || "—"}</Text>
              </Table.Cell>
              <Table.Cell>
                <Badge
                  colorPalette={f.estado ? "green" : "red"}
                  cursor={isAdmin ? "pointer" : "default"}
                  onClick={
                    isAdmin ? () => toggleEstadoMutation.mutate(f.id_fabricante) : undefined
                  }
                >
                  {f.estado ? "Activo" : "Inactivo"}
                </Badge>
              </Table.Cell>
              {isAdmin ? (
                <Table.Cell>
                  <HStack gap={1}>
                    <EditFabricanteDialog
                      fabricante={f}
                      onSuccess={() => queryClient.invalidateQueries({ queryKey: ["fabricantes"] })}
                    />
                    <DeleteFabricanteDialog
                      fabricante={f}
                      onSuccess={() => queryClient.invalidateQueries({ queryKey: ["fabricantes"] })}
                    />
                  </HStack>
                </Table.Cell>
              ) : null}
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>

      {count > PER_PAGE && (
        <Flex justifyContent="flex-end" mt={4}>
          <PaginationRoot count={count} pageSize={PER_PAGE} onPageChange={({ page }) => setPage(page)}>
            <Flex>
              <PaginationPrevTrigger />
              <PaginationItems />
              <PaginationNextTrigger />
            </Flex>
          </PaginationRoot>
        </Flex>
      )}
    </>
  )
}

function StatsCards() {
  const { data } = useQuery({
    queryKey: ["fabricantes", "stats"],
    queryFn: () => FabricantesService.readFabricantes({ limit: 1000 }),
  })

  const total = data?.count ?? 0
  const activos = data?.data?.filter((f) => f.estado).length ?? 0
  const inactivos = total - activos

  return (
    <SimpleGrid columns={{ base: 1, md: 3 }} gap={4} mb={6}>
      <Card.Root p={4}>
        <Card.Body>
          <Flex align="center" justify="space-between">
            <Box>
              <Text fontSize="sm" color="gray.500">Total Fabricantes</Text>
              <Text fontSize="2xl" fontWeight="bold">{total}</Text>
            </Box>
            <Icon as={FiLayers} boxSize={8} color="blue.500" />
          </Flex>
        </Card.Body>
      </Card.Root>
      <Card.Root p={4}>
        <Card.Body>
          <Flex align="center" justify="space-between">
            <Box>
              <Text fontSize="sm" color="gray.500">Activos</Text>
              <Text fontSize="2xl" fontWeight="bold" color="green.500">{activos}</Text>
            </Box>
            <Icon as={FiLayers} boxSize={8} color="green.500" />
          </Flex>
        </Card.Body>
      </Card.Root>
      <Card.Root p={4}>
        <Card.Body>
          <Flex align="center" justify="space-between">
            <Box>
              <Text fontSize="sm" color="gray.500">Inactivos</Text>
              <Text fontSize="2xl" fontWeight="bold" color="red.500">{inactivos}</Text>
            </Box>
            <Icon as={FiLayers} boxSize={8} color="red.500" />
          </Flex>
        </Card.Body>
      </Card.Root>
    </SimpleGrid>
  )
}

export default function Fabricantes() {
  const navigate = useNavigate()
  const { q } = Route.useSearch()
  const [searchQuery, setSearchQuery] = useState(q || "")
  const queryClient = useQueryClient()

  const handleSearch = () => {
    navigate({
      to: "/fabricantes",
      search: { page: 1, q: searchQuery },
    })
  }

  return (
    <Container maxW="full">
      <Flex align="center" justify="space-between" pt={10} mb={6}>
        <Box>
          <Heading size="xl" fontWeight="bold">
            Gestión de Fabricantes
          </Heading>
          <Text color="gray.600" mt={1}>
            Administra las empresas que elaboran los productos
          </Text>
        </Box>
        <AddFabricanteDialog
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["fabricantes"] })}
        />
      </Flex>

      <StatsCards />

      <Flex gap={4} mb={4}>
        <Input
          placeholder="Buscar por nombre o RIF..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          maxW="300px"
        />
        <Button onClick={handleSearch} variant="outline">
          <FiSearch style={{ marginRight: "0.5em" }} />
          Buscar
        </Button>
        {q && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearchQuery("")
              navigate({ to: "/fabricantes", search: { page: 1, q: "" } })
            }}
          >
            Limpiar
          </Button>
        )}
      </Flex>

      <FabricantesTable />
    </Container>
  )
}
