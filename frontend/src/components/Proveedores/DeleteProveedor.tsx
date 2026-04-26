import { Button, DialogTitle, Text, VStack } from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { FiTrash2 } from "react-icons/fi"

import { ProveedoresService } from "@/client"
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTrigger,
} from "@/components/ui/dialog"
import useCustomToast from "@/hooks/useCustomToast"

interface DeleteProveedorProps {
  proveedor: { id_proveedor: number; nombre: string }
}

const DeleteProveedor = ({ proveedor }: DeleteProveedorProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm()

  const softDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await ProveedoresService.deleteProveedor({ id })
    },
    onSuccess: () => {
      showSuccessToast("El proveedor fue eliminado exitosamente")
      setIsOpen(false)
    },
    onError: () => {
      showErrorToast("Ocurrió un error al eliminar el proveedor")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["proveedores"] })
    },
  })

  const forceDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await ProveedoresService.forceDeleteProveedor({ id })
    },
    onSuccess: () => {
      showSuccessToast("El proveedor fue eliminado definitivamente")
      setIsOpen(false)
    },
    onError: (error: any) => {
      showErrorToast(
        error?.body?.detail ||
          "Ocurrió un error al eliminar definitivamente el proveedor (verifica que no tenga guias asociadas)"
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["proveedores"] })
    },
  })

  const onSubmit = async () => {
    softDeleteMutation.mutate(proveedor.id_proveedor)
  }

  const onForceDelete = async () => {
    forceDeleteMutation.mutate(proveedor.id_proveedor)
  }

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      role="alertdialog"
      open={isOpen}
      onOpenChange={({ open }) => setIsOpen(open)}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" colorPalette="red">
          <FiTrash2 fontSize="16px" />
          Eliminar proveedor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Eliminar proveedor</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <VStack align="flex-start" spacing={3}>
              <Text>
                ¿Estás seguro de que deseas eliminar el proveedor{" "}
                <strong>{proveedor.nombre}</strong>?
              </Text>
              <Text fontSize="sm">
                - <strong>Eliminar (suave)</strong>: el proveedor se marca como{" "}
                inactivo y se mantiene para históricos. Las guias asociadas no se
                tocan.
              </Text>
              <Text fontSize="sm">
                - <strong>Eliminar definitivamente</strong>: intenta borrar el
                proveedor de la base de datos. Solo se permitirá si no tiene
                guias asociadas.
              </Text>
            </VStack>
          </DialogBody>

          <DialogFooter gap={2}>
            <DialogActionTrigger asChild>
              <Button variant="subtle" colorPalette="gray" disabled={isSubmitting}>
                Cancelar
              </Button>
            </DialogActionTrigger>
              <Button
                variant="outline"
                colorPalette="red"
                type="submit"
                loading={isSubmitting}
              >
                Eliminar (suave)
              </Button>
              <Button
                variant="solid"
                colorPalette="red"
                type="button"
                onClick={onForceDelete}
                loading={forceDeleteMutation.isPending}
              >
                Eliminar definitivamente
              </Button>
          </DialogFooter>
          <DialogCloseTrigger />
        </form>
      </DialogContent>
    </DialogRoot>
  )
}

export default DeleteProveedor
