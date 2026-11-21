"use client"

import { useEffect, useState } from "react"
import { cx } from "@/libs/cx"

// Contenedor del header público (SPEC 24, rehecho en SPEC 40). Las páginas
// públicas van siempre en claro, así que el header no cambia de tema: arriba
// de todo es transparente (en la landing, el velo blanco del hero le da
// fondo) y con scroll toma el fondo de la página translúcido, desenfoque y una
// línea fina abajo, en 300 ms. Listener nativo y pasivo, sin Motion
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
        "sticky top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-300 ease-out motion-reduce:transition-none",
        scrolled
          ? "bg-background/80 shadow-[0_1px_0_var(--border)] backdrop-blur-md supports-backdrop-filter:bg-background/70"
          : "bg-transparent"
      )}
    >
      {children}
    </header>
  )
}
