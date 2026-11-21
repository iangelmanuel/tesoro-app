"use client"

import { useEffect, useState } from "react"
import { cx } from "@/libs/cx"

// Contenedor del header público (SPEC 24, rehecho en SPEC 40). Las páginas
// públicas van siempre en claro. Mientras el header está encima de una
// sección con `data-header-tone="on-media"` (el video del hero) es
// transparente y toma los tokens claros de `.on-media`; al pasarla, toma el
// fondo de la página translúcido, desenfoque y una línea fina abajo, en
// 300 ms. Listener nativo y pasivo, sin Motion
const HEADER_HEIGHT = 64

export function SiteHeaderShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false)
  const [pastMedia, setPastMedia] = useState(false)
  const [hasMedia, setHasMedia] = useState(false)

  useEffect(() => {
    const media = document.querySelector('[data-header-tone="on-media"]')
    const update = () => {
      setScrolled(window.scrollY > 8)
      setHasMedia(media !== null)
      setPastMedia(
        media !== null && media.getBoundingClientRect().bottom <= HEADER_HEIGHT
      )
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update, { passive: true })
    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [])

  return (
    <header
      // Sin la marca, y si la página tiene video (CSS con :has), el header
      // usa los tokens claros de `.on-media`: así ya sale bien en el HTML
      data-site-header
      data-past-media={pastMedia || undefined}
      className={cx(
        "sticky top-0 z-40 text-foreground transition-[background-color,box-shadow,backdrop-filter] duration-300 ease-out motion-reduce:transition-none",
        scrolled && (pastMedia || !hasMedia)
          ? "bg-background/80 shadow-[0_1px_0_var(--border)] backdrop-blur-md supports-backdrop-filter:bg-background/70"
          : "bg-transparent"
      )}
    >
      {children}
    </header>
  )
}
