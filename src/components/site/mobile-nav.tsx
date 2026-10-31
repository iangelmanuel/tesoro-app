"use client"

import { useState } from "react"
import Link from "next/link"
import { MenuIcon } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet"
import { SITE } from "@/config/site"

// `children` son los botones de sesión: llegan del servidor ya envueltos en
// su `<Suspense>`, así este componente no lee cookies
export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
    >
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Abrir menú"
          className="md:hidden"
        >
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
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
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2 text-base text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t p-4 [&>a]:w-full">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
