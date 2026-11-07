"use client"

import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@heroui/react"
import {
  Bot,
  Eye,
  type LucideIcon,
  ShieldCheck,
  SlidersHorizontal,
  User
} from "lucide-react"
import { SITE } from "@/config/site"

type AccountIcon = (typeof SITE.account.sections)[number]["icon"]

const ICONS: Record<AccountIcon, LucideIcon> = {
  User,
  Bot,
  ShieldCheck,
  Eye,
  SlidersHorizontal
}

/**
 * Aside interno de Cuenta. En escritorio es una lista vertical; en el
 * teléfono (< 768 px) una lista horizontal con scroll, con controles de 44 px.
 */
export function AccountNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Secciones de la cuenta"
      className="md:w-52 md:shrink-0"
    >
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
        {SITE.account.sections.map((section) => {
          const Icon = ICONS[section.icon]
          const active = pathname === section.href

          return (
            <li
              key={section.href}
              className="shrink-0"
            >
              <Link
                href={section.href as Route}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none",
                  active
                    ? "bg-default text-foreground"
                    : "text-muted hover:bg-default/60 hover:text-foreground"
                )}
              >
                <Icon
                  aria-hidden="true"
                  className="size-4 shrink-0"
                />
                {section.name}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
