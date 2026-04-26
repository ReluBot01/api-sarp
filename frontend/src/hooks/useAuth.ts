import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"

import {
  type Body_login_login_access_token as AccessToken,
  type ApiError,
  LoginService,
  type UserPublic,
  type UserRegister,
  UsersService,
} from "@/client"
import { showApiErrorToast } from "@/apiErrorToast"
import { toaster } from "@/components/ui/toaster"
import { handleError } from "@/utils"

const isLoggedIn = () => {
  return localStorage.getItem("access_token") !== null
}

const useAuth = () => {
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: user, isPending: isUserPending } = useQuery<UserPublic | null, Error>({
    queryKey: ["currentUser"],
    queryFn: UsersService.readUserMe,
    enabled: isLoggedIn(),
  })

  const signUpMutation = useMutation({
    mutationFn: (data: UserRegister) =>
      UsersService.registerUser({ requestBody: data }),

    onSuccess: () => {
      navigate({ to: "/login" })
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })

  const login = async (data: AccessToken) => {
    const response = await LoginService.loginAccessToken({
      formData: data,
    })
    localStorage.setItem("access_token", response.access_token)
  }

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: () => {
      toaster.create({
        type: "success",
        title: "¡Bienvenido!",
        description: "Has iniciado sesión correctamente.",
      })
      navigate({ to: "/" })
    },
    onError: (err: ApiError) => {
      showApiErrorToast(err, "login")
    },
  })

  const logout = () => {
    localStorage.removeItem("access_token")
    navigate({ to: "/login" })
  }

  const isAdmin = user?.is_superuser === true

  return {
    signUpMutation,
    loginMutation,
    logout,
    user,
    isAdmin,
    isUserPending,
    error,
    resetError: () => setError(null),
  }
}

export { isLoggedIn }
export default useAuth
