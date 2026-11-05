"use client"

import Link from "next/link"
import { Drawer } from "@heroui/react"
import { Logo } from "@/components/brand/logo"
import { SITE } from "@/config/site"

// Cajón del menú móvil. Se carga recién al tocar el botón (mobile-nav.tsx),
// así HeroUI/react-aria no entra en el JS inicial de la landing. `children`
// son los botones de sesión: llegan del servidor ya envueltos en su
// `<Suspense>`, así este componente no lee cookies
export default function MobileNavDrawer({
  open,
  onOpenChange,
  children
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  return (
    <Drawer
      isOpen={open}
      onOpenChange={onOpenChange}
    >
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-label="Navegación principal">
            <Drawer.CloseTrigger aria-label="Cerrar menú" />
            <Drawer.Header>
              <Drawer.Heading>
                <Logo />
              </Drawer.Heading>
            </Drawer.Header>

            <Drawer.Body>
              <nav aria-label="Principal">
                <ul className="flex flex-col gap-1">
                  {SITE.navigation.main.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => onOpenChange(false)}
                        className="block rounded-lg px-3 py-2 text-base text-muted transition-colors hover:bg-default hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </Drawer.Body>

            <Drawer.Footer className="flex flex-col gap-2 border-t border-separator pt-4 [&>a]:w-full">
              {children}
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  )
}
