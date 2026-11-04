"use client"

import { Button, cn } from "@heroui/react"
import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

// Los íconos se alternan con la clase `dark`, así el primer render del
// servidor coincide con el del cliente sin esperar a montar. Al cambiar de
// tema, uno gira y se encoge mientras el otro entra
export function ThemeToggle({
  size,
  className
}: Pick<React.ComponentProps<typeof Button>, "size" | "className">) {
  const { resolvedTheme, setTheme } = useTheme()
  const icon =
    "absolute transition-[rotate,scale,opacity] duration-300 ease-out motion-reduce:transition-none"

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      isIconOnly
      className={cn("relative overflow-hidden", className)}
      aria-label="Cambiar entre tema claro y oscuro"
      onPress={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon
        className={cn(
          icon,
          "scale-50 -rotate-90 opacity-0 dark:scale-100 dark:rotate-0 dark:opacity-100"
        )}
      />
      <MoonIcon
        className={cn(
          icon,
          "scale-100 rotate-0 opacity-100 dark:scale-50 dark:rotate-90 dark:opacity-0"
        )}
      />
    </Button>
  )
}
