import { Badge, Container, Flex, Heading, Table } from "@chakra-ui/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"

import { type UserPublic, UsersService } from "@/client"
import AddUser from "@/components/Admin/AddUser"
import { UserActionsMenu } from "@/components/Common/UserActionsMenu"
import PendingUsers from "@/components/Pending/PendingUsers"
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination.tsx"
import { usePermissions } from "@/hooks/usePermissions"

const usersSearchSchema = z.object({
  page: z.number().catch(1),
})

const PER_PAGE = 10

function getUsersQueryOptions({ page }: { page: number }) {
  return {
    queryFn: () =>
      UsersService.readUsers({ skip: (page - 1) * PER_PAGE, limit: PER_PAGE }),
    queryKey: ["users", { page }],
  }
}

export const Route = createFileRoute("/_layout/admin")({
  component: Admin,
  validateSearch: (search) => usersSearchSchema.parse(search),
})

function UsersTable() {
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])
  const navigate = useNavigate({ from: Route.fullPath })
  const { page } = Route.useSearch()

  const { data, isLoading, isPlaceholderData } = useQuery({
    ...getUsersQueryOptions({ page }),
    placeholderData: (prevData) => prevData,
  })

  const setPage = (page: number) => {
    navigate({
      to: "/admin",
      search: (prev) => ({ ...prev, page }),
    })
  }

  const users = data?.data.slice(0, PER_PAGE) ?? []
  const count = data?.count ?? 0

  if (isLoading) {
    return <PendingUsers />
  }

  return (
    <>
      <Table.Root size={{ base: "sm", md: "md" }}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader w="sm">Nombre completo</Table.ColumnHeader>
            <Table.ColumnHeader w="sm">Email</Table.ColumnHeader>
            <Table.ColumnHeader w="sm">Tipo</Table.ColumnHeader>
            <Table.ColumnHeader w="sm">Estado</Table.ColumnHeader>
            <Table.ColumnHeader w="sm">Acciones</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {users?.map((user) => (
            <Table.Row key={user.id} opacity={isPlaceholderData ? 0.5 : 1}>
              <Table.Cell color={!user.full_name ? "gray" : "inherit"}>
                {user.full_name || "N/A"}
                {currentUser?.id === user.id && (
                  <Badge ml="1" colorPalette="blue">
                    Tú
                  </Badge>
                )}
              </Table.Cell>
              <Table.Cell truncate maxW="sm">
                {user.email}
              </Table.Cell>
              <Table.Cell>
                {user.is_superuser ? (
                  <Badge colorPalette="purple">Administrador</Badge>
                ) : (
                  <Badge colorPalette="gray">Usuario</Badge>
                )}
              </Table.Cell>
              <Table.Cell>
                {user.is_active ? (
                  <Badge colorPalette="green">Activo</Badge>
                ) : (
                  <Badge colorPalette="red">Inactivo</Badge>
                )}
              </Table.Cell>
              <Table.Cell>
                <UserActionsMenu
                  user={user}
                  disabled={currentUser?.id === user.id}
                />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      <Flex justifyContent="flex-end" mt={4}>
        <PaginationRoot
          count={count}
          pageSize={PER_PAGE}
          onPageChange={({ page }) => setPage(page)}
        >
          <Flex>
            <PaginationPrevTrigger />
            <PaginationItems />
            <PaginationNextTrigger />
          </Flex>
        </PaginationRoot>
      </Flex>
    </>
  )
}

function Admin() {
  const { isSuperUser } = usePermissions()
  const navigate = useNavigate()

  // Solo superusuarios pueden acceder
  if (!isSuperUser()) {
    navigate({ to: "/" })
    return null
  }

  return (
    <Container maxW="full">
      <Heading size="lg" pt={12}>
        Administración de Usuarios
      </Heading>
      <Flex gap={3} wrap="wrap" my={4}>
        <AddUser />
      </Flex>
      <UsersTable />
    </Container>
  )
}
