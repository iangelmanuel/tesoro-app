"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { SITE } from "@/config/site"
import { cx } from "@/libs/cx"

// Contenedor del header público (SPEC 24, rehecho en SPEC 40). Tres estados:
// - arriba de todo: transparente, sin fondo ni línea;
// - con scroll y todavía sobre el hero (banda oscura): cristal oscuro, sigue
//   en tema oscuro para no saltar a claro encima del video;
// - pasado el hero (o en páginas sin hero): fondo de la página translúcido,
//   desenfoque y una línea fina abajo.
// El tema cambia solo al cruzar el borde inferior del hero, y los colores de
// todo el header se funden en 300 ms en vez de cambiar de golpe. Listeners
// nativos y pasivos, sin Motion, para no sumar JS
export function SiteHeaderShell({ children }: { children: React.ReactNode }) {
  const isHome = usePathname() === SITE.routes.home
  const [scrolled, setScrolled] = useState(false)
  // En el servidor, en la landing se asume que arranca sobre el hero
  const [overHero, setOverHero] = useState(isHome)

  useEffect(() => {
    const hero = isHome ? document.getElementById("hero") : null
    // El header (4 rem) está sobre el hero mientras el borde inferior del
    // hero siga por debajo de él. Una lectura por evento, sin escrituras
    const update = () => {
      setScrolled(window.scrollY > 8)
      setOverHero(hero !== null && hero.getBoundingClientRect().bottom > 64)
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update, { passive: true })
    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [isHome])

  return (
    <header
      className={cx(
        "sticky top-0 z-40 text-foreground transition-[background-color,box-shadow,backdrop-filter] duration-300 ease-out motion-reduce:transition-none",
        // Los colores de dentro se funden con el cambio de tema
        "[&_*]:transition-[color,background-color] [&_*]:duration-300 motion-reduce:[&_*]:transition-none",
        overHero && "dark",
        !scrolled
          ? "bg-transparent"
          : overHero
            ? "bg-background/45 backdrop-blur-md"
            : "bg-background/80 shadow-[0_1px_0_var(--separator)] backdrop-blur-md supports-backdrop-filter:bg-background/70"
      )}
    >
      {children}
    </header>
  )
}
