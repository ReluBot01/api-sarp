import { Button, Text } from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { FiTrash } from "react-icons/fi"

import { LotesService } from "@/client"
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import useCustomToast from "@/hooks/useCustomToast"

function invalidateLotesQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["lotes"] })
  queryClient.invalidateQueries({ queryKey: ["lotes-stats"] })
  queryClient.invalidateQueries({ queryKey: ["lotes", "stats"] })
}

type CerrarProps = {
  idLote: number
  numeroGuia: string
  disabled?: boolean
}

/** Marcar guía como cerrada (API delete suave). */
export function CerrarGuiaConfirmButton({ idLote, numeroGuia, disabled }: CerrarProps) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: () => LotesService.deleteLote({ id: idLote }),
    onSuccess: () => {
      showSuccessToast("Guia marcada como cerrada")
      invalidateLotesQueries(queryClient)
      setOpen(false)
    },
    onError: (error: { body?: { detail?: string } }) => {
      showErrorToast(error?.body?.detail || "Error al cerrar la guia")
    },
  })

  return (
    <DialogRoot
      role="alertdialog"
      placement="center"
      size={{ base: "xs", md: "sm" }}
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
    >
      <DialogTrigger asChild>
        <Button
          size="xs"
          variant="outline"
          colorPalette="gray"
          disabled={disabled || mutation.isPending}
        >
          Cerrar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar cierre de guía</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        <DialogBody>
          <Text fontSize="sm">
            ¿Marcar la guía <strong>{numeroGuia}</strong> como cerrada? No elimina los productos; solo
            cambia el estado operativo de la guía.
          </Text>
        </DialogBody>
        <DialogFooter gap={2}>
          <DialogActionTrigger asChild>
            <Button variant="subtle" colorPalette="gray" disabled={mutation.isPending}>
              Cancelar
            </Button>
          </DialogActionTrigger>
          <Button
            colorPalette="gray"
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Sí, cerrar guía
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}

type EliminarProps = {
  idLote: number
  numeroGuia: string
  disabled?: boolean
}

/** Eliminación definitiva de guía y productos asociados. */
export function EliminarGuiaConfirmButton({ idLote, numeroGuia, disabled }: EliminarProps) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: () => LotesService.forceDeleteLote({ id: idLote }),
    onSuccess: () => {
      showSuccessToast("Guia eliminada definitivamente")
      invalidateLotesQueries(queryClient)
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      setOpen(false)
    },
    onError: (error: { body?: { detail?: string } }) => {
      showErrorToast(
        error?.body?.detail ||
          "Error al eliminar definitivamente la guia (verifica que no esté siendo usada en otros registros)"
      )
    },
  })

  return (
    <DialogRoot
      role="alertdialog"
      placement="center"
      size={{ base: "xs", md: "sm" }}
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
    >
      <DialogTrigger asChild>
        <Button
          size="xs"
          variant="ghost"
          colorPalette="red"
          disabled={disabled || mutation.isPending}
          aria-label="Eliminar guía definitivamente"
        >
          <FiTrash />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar guía definitivamente</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        <DialogBody>
          <Text fontSize="sm">
            Vas a eliminar la guía <strong>{numeroGuia}</strong> y{" "}
            <strong>todos sus productos asociados</strong>. Esta acción no se puede deshacer.
          </Text>
        </DialogBody>
        <DialogFooter gap={2}>
          <DialogActionTrigger asChild>
            <Button variant="subtle" colorPalette="gray" disabled={mutation.isPending}>
              Cancelar
            </Button>
          </DialogActionTrigger>
          <Button
            colorPalette="red"
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Sí, eliminar definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}
