"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

const ICON =
  "absolute size-5 transition-[rotate,scale,opacity] duration-300 ease-out motion-reduce:transition-none"

// Toggle de tema del header público: un botón nativo (sin HeroUI) para no
// sumar react-aria al JS inicial de la landing. Mismo comportamiento que
// ThemeToggle del dashboard: los íconos se alternan con la clase `dark`
export function SiteThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <button
      type="button"
      aria-label="Cambiar entre tema claro y oscuro"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="relative flex size-11 items-center justify-center overflow-hidden rounded-full text-foreground transition-colors outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
    >
      <SunIcon
        aria-hidden="true"
        className={`${ICON} scale-50 -rotate-90 opacity-0 dark:scale-100 dark:rotate-0 dark:opacity-100`}
      />
      <MoonIcon
        aria-hidden="true"
        className={`${ICON} scale-100 rotate-0 opacity-100 dark:scale-50 dark:rotate-90 dark:opacity-0`}
      />
    </button>
  )
}
