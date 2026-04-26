import {
  Button,
  DialogActionTrigger,
  DialogTitle,
  Input,
  Text,
  Grid,
  GridItem,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"
import { FaPlus } from "react-icons/fa"
import { UsersService } from "@/client"
import type { ApiError } from "@/client/core/ApiError"
import useCustomToast from "@/hooks/useCustomToast"
import { emailPattern, handleError } from "@/utils"
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTrigger,
} from "../ui/dialog"
import { Field } from "../ui/field"

interface UserCreateForm {
  email: string
  full_name?: string
  password: string
  confirm_password: string
}

const AddUser = () => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isValid, isSubmitting },
  } = useForm<UserCreateForm>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      email: "",
      full_name: "",
      password: "",
      confirm_password: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: { email: string; password: string; full_name?: string }) =>
      UsersService.createUser({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Usuario creado exitosamente.")
      reset()
      setIsOpen(false)
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })

  const onSubmit: SubmitHandler<UserCreateForm> = (data) => {
    const { confirm_password, ...userData } = data
    mutation.mutate(userData)
  }

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => setIsOpen(open)}
    >
      <DialogTrigger asChild>
        <Button value="add-user" my={4}>
          <FaPlus fontSize="16px" />
          Agregar usuario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Agregar usuario</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text mb={4}>
              Completa el formulario para agregar un nuevo usuario al sistema.
            </Text>

            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
              <GridItem>
                <Field
                  required
                  invalid={!!errors.email}
                  errorText={errors.email?.message}
                  label="Correo"
                >
                  <Input
                    {...register("email", {
                      required: "El correo es obligatorio",
                      pattern: emailPattern,
                    })}
                    placeholder="Correo"
                    type="email"
                  />
                </Field>
              </GridItem>

              <GridItem>
                <Field
                  invalid={!!errors.full_name}
                  errorText={errors.full_name?.message}
                  label="Nombre completo"
                >
                  <Input
                    {...register("full_name")}
                    placeholder="Nombre completo"
                    type="text"
                  />
                </Field>
              </GridItem>

              <GridItem>
                <Field
                  required
                  invalid={!!errors.password}
                  errorText={errors.password?.message}
                  label="Contraseña"
                >
                  <Input
                    {...register("password", {
                      required: "La contraseña es obligatoria",
                      minLength: {
                        value: 8,
                        message: "La contraseña debe tener al menos 8 caracteres",
                      },
                    })}
                    placeholder="Contraseña"
                    type="password"
                  />
                </Field>
              </GridItem>

              <GridItem>
                <Field
                  required
                  invalid={!!errors.confirm_password}
                  errorText={errors.confirm_password?.message}
                  label="Confirmar contraseña"
                >
                  <Input
                    {...register("confirm_password", {
                      required: "Por favor confirma la contraseña",
                      validate: (value) =>
                        value === getValues().password ||
                        "Las contraseñas no coinciden",
                    })}
                    placeholder="Confirmar contraseña"
                    type="password"
                  />
                </Field>
              </GridItem>
            </Grid>
          </DialogBody>

          <DialogFooter gap={2}>
            <DialogActionTrigger asChild>
              <Button
                variant="subtle"
                colorPalette="gray"
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
            </DialogActionTrigger>
            <Button
              variant="solid"
              type="submit"
              disabled={!isValid}
              loading={isSubmitting}
            >
              Guardar
            </Button>
          </DialogFooter>
        </form>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  )
}

export default AddUser
