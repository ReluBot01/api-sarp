import { Flex } from "@chakra-ui/react"
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { useEffect } from "react"

import Navbar from "@/components/Common/Navbar"
import Sidebar from "@/components/Common/Sidebar"
import { toaster } from "@/components/ui/toaster"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
  },
})

function Layout() {
  useEffect(() => {
    if (!isLoggedIn()) return

    const timeoutMinutes = Number(import.meta.env.VITE_INACTIVITY_TIMEOUT_MINUTES ?? 10)
    const inactivityTimeoutMs =
      Number.isFinite(timeoutMinutes) && timeoutMinutes > 0
        ? timeoutMinutes * 60 * 1000
        : 10 * 60 * 1000

    const warningLeadMs = 60 * 1000
    let timeoutId: number | undefined
    let warningTimeoutId: number | undefined
    let lastActivityAt = Date.now()
    let warningShown = false

    const logoutByInactivity = () => {
      localStorage.removeItem("access_token")
      window.location.href = "/login"
    }

    const warnBeforeLogout = () => {
      warningShown = true
      toaster.create({
        type: "info",
        title: "Inactividad detectada",
        description: "Tu sesión se cerrará en 1 minuto si no detectamos actividad.",
      })
    }

    const clearTimers = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
      if (warningTimeoutId !== undefined) {
        window.clearTimeout(warningTimeoutId)
      }
    }

    const scheduleFromLastActivity = () => {
      clearTimers()

      const elapsedMs = Date.now() - lastActivityAt
      const remainingMs = inactivityTimeoutMs - elapsedMs
      if (remainingMs <= 0) {
        logoutByInactivity()
        return
      }

      const warningDelayMs = remainingMs - warningLeadMs
      if (warningDelayMs <= 0) {
        if (!warningShown) warnBeforeLogout()
      } else {
        warningTimeoutId = window.setTimeout(warnBeforeLogout, warningDelayMs)
      }

      timeoutId = window.setTimeout(logoutByInactivity, remainingMs)
    }

    const registerActivity = () => {
      lastActivityAt = Date.now()
      warningShown = false
      scheduleFromLastActivity()
    }

    const activityEvents: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "focus",
    ]

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, registerActivity, { passive: true })
    })

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleFromLastActivity()
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    scheduleFromLastActivity()

    return () => {
      clearTimers()
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, registerActivity)
      })
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [])

  return (
    <Flex direction="column" h="100vh">
      <Navbar />
      <Flex flex="1" overflow="hidden">
        <Sidebar />
        <Flex flex="1" direction="column" p={4} overflowY="auto">
          <Outlet />
        </Flex>
      </Flex>
    </Flex>
  )
}

export default Layout
