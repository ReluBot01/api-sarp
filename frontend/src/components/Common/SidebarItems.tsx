import { Box, Flex, Icon, Text } from "@chakra-ui/react"
import { Link as RouterLink } from "@tanstack/react-router"
import { 
  FiHome, 
  FiSettings, 
  FiUsers, 
  FiTruck, 
  FiPackage, 
  FiFileText,
  FiClipboard,
  FiBox,
  FiBriefcase
} from "react-icons/fi"
import type { IconType } from "react-icons/lib"
import useAuth from "@/hooks/useAuth"

interface SidebarItemsProps {
  onClose?: () => void
}

interface Item {
  icon: IconType
  title: string
  path: string
  adminOnly?: boolean
}

const SidebarItems = ({ onClose }: SidebarItemsProps) => {
  const { isAdmin } = useAuth()

  const menuItems: Item[] = [
    { icon: FiHome, title: "Inicio", path: "/" },
    { icon: FiClipboard, title: "Recepción de Guias", path: "/recepciones" },
    { icon: FiPackage, title: "Guias", path: "/lotes" },
    { icon: FiBox, title: "Productos", path: "/productos" },
    { icon: FiTruck, title: "Proveedores", path: "/proveedores" },
    { icon: FiBriefcase, title: "Fabricantes", path: "/fabricantes" },
    { icon: FiFileText, title: "Reportes", path: "/reportes" },
    { icon: FiUsers, title: "Administración", path: "/admin", adminOnly: true },
    { icon: FiSettings, title: "Configuración", path: "/settings" },
  ]

  // Filtrar items que requieren admin
  const visibleItems = menuItems.filter(item => !item.adminOnly || isAdmin)

  const listItems = visibleItems.map(({ icon, title, path }) => (
    <RouterLink key={title} to={path} onClick={onClose}>
      <Flex
        gap={4}
        px={4}
        py={2}
        _hover={{
          background: "gray.subtle",
        }}
        alignItems="center"
        fontSize="sm"
      >
        <Icon as={icon} alignSelf="center" />
        <Text ml={2}>{title}</Text>
      </Flex>
    </RouterLink>
  ))

  return (
    <>
      <Text fontSize="xs" px={4} py={2} fontWeight="bold">
        Sistema de Inventario
      </Text>
      <Box>{listItems}</Box>
    </>
  )
}

export default SidebarItems
