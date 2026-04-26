import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import ReactDOM from "react-dom/client"
import { ApiError, OpenAPI } from "./client"
import { CustomProvider } from "./components/ui/provider"
import { routeTree } from "./routeTree.gen"

OpenAPI.BASE = import.meta.env.VITE_API_URL
OpenAPI.TOKEN = async () => {
  return localStorage.getItem("access_token") || ""
}

/**
 * 401/403 en el login (credenciales incorrectas, usuario inactivo) no deben
 * disparar logout + recarga: el MutationCache global ejecutaría esto antes de
 * que el toast de error pueda mostrarse.
 */
const isFailedLoginRequest = (error: ApiError) =>
  typeof error.url === "string" && error.url.includes("/login/access-token")

const handleApiError = (error: Error) => {
  if (!(error instanceof ApiError)) return
  if (![401, 403].includes(error.status)) return
  if (isFailedLoginRequest(error)) return

  localStorage.removeItem("access_token")
  window.location.href = "/login"
}
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleApiError,
  }),
  mutationCache: new MutationCache({
    onError: handleApiError,
  }),
})

const router = createRouter({ routeTree })
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}


ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CustomProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </CustomProvider>
  </StrictMode>,
)
