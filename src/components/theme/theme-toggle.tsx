"use client"

import { Button } from "@heroui/react"
import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

// Los íconos se alternan con la clase `dark`, así el primer render del
// servidor coincide con el del cliente sin esperar a montar
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      type="button"
      variant="ghost"
      isIconOnly
      aria-label="Cambiar entre tema claro y oscuro"
      onPress={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  )
}
