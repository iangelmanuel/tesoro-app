"use client"

import { useEffect, useState } from "react"
import { cx } from "@/libs/cx"

// Contenedor del header público (SPEC 24): transparente arriba de todo y con
// fondo y borde en cuanto la página se desplaza. Listener nativo y pasivo,
// sin Motion, para no sumar JS al header de todas las páginas públicas
export function SiteHeaderShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8)
    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [])

  return (
    <header
      className={cx(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-300 motion-reduce:transition-none",
        scrolled
          ? "border-border bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60"
          : "border-transparent bg-transparent"
      )}
    >
      {children}
    </header>
  )
}
