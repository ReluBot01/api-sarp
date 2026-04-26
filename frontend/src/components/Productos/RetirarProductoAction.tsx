import { Button, Text, VStack } from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { ProductosService } from "@/client/ProductosService"
import useCustomToast from "@/hooks/useCustomToast"
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

type Props = {
  idProducto: number
  nombre: string
  canRetirar: boolean
  isRetirado: boolean
  /** Botón a ancho completo (p. ej. cards del dashboard) */
  fullWidth?: boolean
}

export function RetirarProductoAction({
  idProducto,
  nombre,
  canRetirar,
  isRetirado,
  fullWidth = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: () => ProductosService.retirarProducto({ id: idProducto }),
    onSuccess: () => {
      showSuccessToast("Producto retirado del circuito de alertas")
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      queryClient.invalidateQueries({ queryKey: ["productos-stats"] })
      queryClient.invalidateQueries({ queryKey: ["productos", "stats"] })
      queryClient.invalidateQueries({ queryKey: ["productos", "alertas"] })
      queryClient.invalidateQueries({ queryKey: ["lotes-stats"] })
      queryClient.invalidateQueries({ queryKey: ["lotes", "stats"] })
      queryClient.invalidateQueries({ queryKey: ["productos", "pendientes-retiro"] })
      setOpen(false)
    },
    onError: (err: unknown) => {
      const detail =
        err && typeof err === "object" && "body" in err && err.body && typeof err.body === "object"
          ? (err.body as { detail?: string }).detail
          : undefined
      showErrorToast(typeof detail === "string" ? detail : "No se pudo registrar el retiro")
    },
  })

  if (isRetirado || !canRetirar) {
    return (
      <Text fontSize="xs" color="fg.muted">
        —
      </Text>
    )
  }

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
          colorPalette="orange"
          width={fullWidth ? "full" : undefined}
        >
          Retirar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar retiro</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        <DialogBody>
          <VStack align="stretch" gap={3}>
            <Text fontSize="sm">
              Vas a registrar el retiro físico de <strong>{nombre}</strong>. Esta acción es consciente
              y queda registrada para auditoría.
            </Text>
            <Text fontSize="sm" color="fg.muted">
              El producto dejará de generar alertas por vencimiento y seguirá visible en la guía de
              recepción.
            </Text>
          </VStack>
        </DialogBody>
        <DialogFooter gap={2}>
          <DialogActionTrigger asChild>
            <Button variant="subtle" colorPalette="gray" disabled={mutation.isPending}>
              Cancelar
            </Button>
          </DialogActionTrigger>
          <Button
            colorPalette="orange"
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Sí, registrar retiro
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}
