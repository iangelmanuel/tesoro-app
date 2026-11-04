"use client"

import { useState } from "react"
import Link from "next/link"
import { Button, Drawer } from "@heroui/react"
import { MenuIcon } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { SITE } from "@/config/site"

// `children` son los botones de sesión: llegan del servidor ya envueltos en
// su `<Suspense>`, así este componente no lee cookies
export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <Drawer
      isOpen={open}
      onOpenChange={setOpen}
    >
      <Button
        variant="ghost"
        isIconOnly
        aria-label="Abrir menú"
        className="md:hidden"
      >
        <MenuIcon />
      </Button>
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
                        onClick={() => setOpen(false)}
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
