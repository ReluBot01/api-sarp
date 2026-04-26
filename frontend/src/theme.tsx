import { createSystem, defaultConfig } from "@chakra-ui/react"
import { buttonRecipe } from "./theme/button.recipe"

export const system = createSystem(defaultConfig, {
  globalCss: {
    html: {
      fontSize: "16px",
    },
    body: {
      fontSize: "0.875rem",
      margin: 0,
      padding: 0,
    },
    ".main-link": {
      color: "ui.main",
      fontWeight: "bold",
    },
    // Oculta el chip/icono circular del navegador (autocompletado de cuentas / passkeys)
    "input::-webkit-credentials-auto-fill-button": {
      display: "none !important",
      visibility: "hidden",
      pointerEvents: "none",
      position: "absolute",
      right: "0",
    },
    "input::-webkit-contacts-auto-fill-button": {
      display: "none !important",
      visibility: "hidden",
      pointerEvents: "none",
      position: "absolute",
      right: "0",
    },
  },
  theme: {
    tokens: {
      colors: {
        ui: {
          main: { value: "#2563eb" }, // Azul principal (blue-600) — reemplaza el verde menta
        },
      },
    },
    recipes: {
      button: buttonRecipe,
    },
  },
})
