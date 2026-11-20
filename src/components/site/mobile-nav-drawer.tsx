"use client"

import Link from "next/link"
import { Logo } from "@/components/brand/logo"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet"
import { SITE } from "@/config/site"

// Cajón del menú móvil: el mismo Sheet modal que el aside móvil del
// dashboard (foco atrapado, Escape lo cierra). Se carga recién al tocar el
// botón (mobile-nav.tsx), así Base UI no entra en el JS inicial de la
// landing. `children` son los botones de sesión: llegan del servidor ya
// envueltos en su `<Suspense>`, así este componente no lee cookies
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
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
    >
      <SheetContent
        side="right"
        className="w-[85%] max-w-sm"
      >
        <SheetHeader>
          <SheetTitle>
            <Logo />
          </SheetTitle>
          <SheetDescription className="sr-only">
            Navegación principal
          </SheetDescription>
        </SheetHeader>

        <nav
          aria-label="Principal"
          className="px-4"
        >
          <ul className="flex flex-col gap-1">
            {SITE.navigation.main.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className="flex min-h-11 items-center rounded-lg px-3 text-base text-muted-foreground transition-colors outline-none hover:bg-highlight hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <SheetFooter className="border-t border-border pt-4 [&>a]:w-full">
          {children}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
