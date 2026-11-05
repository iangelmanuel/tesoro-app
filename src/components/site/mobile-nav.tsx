"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { MenuIcon } from "lucide-react"

// El cajón (HeroUI Drawer) se pide recién al primer toque del botón
const MobileNavDrawer = dynamic(() => import("./mobile-nav-drawer"), {
  ssr: false
})

// Botón del menú móvil. `children` son los botones de sesión y GitHub, que
// llegan del servidor y se muestran dentro del cajón
export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menú"
        aria-expanded={open}
        onClick={() => {
          setLoaded(true)
          setOpen(true)
        }}
        className="flex size-11 items-center justify-center rounded-full text-foreground transition-colors outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus md:hidden"
      >
        <MenuIcon
          aria-hidden="true"
          className="size-5"
        />
      </button>
      {loaded && (
        <MobileNavDrawer
          open={open}
          onOpenChange={setOpen}
        >
          {children}
        </MobileNavDrawer>
      )}
    </>
  )
}
