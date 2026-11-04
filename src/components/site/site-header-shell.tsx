"use client"

import { useState } from "react"
import { cn } from "@heroui/react"
import { useMotionValueEvent, useScroll } from "motion/react"

// Contenedor del header público (SPEC 24): transparente arriba de todo y con
// fondo y borde en cuanto la página se desplaza.
export function SiteHeaderShell({ children }: { children: React.ReactNode }) {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8))

  return (
    <header
      className={cn(
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
