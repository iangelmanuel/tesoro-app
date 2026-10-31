import Link from "next/link"
import { Logo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { SITE } from "@/config/site"
import { SiteHeaderSession } from "./site-header-session"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link
          href={SITE.routes.home}
          aria-label={`${SITE.info.name}, inicio`}
          className="rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Logo />
        </Link>

        <nav
          aria-label="Principal"
          className="hidden md:block"
        >
          <ul className="flex items-center gap-1">
            {SITE.navigation.main.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {/* Ancho fijo: con o sin sesión la isla no desplaza el header */}
          <div className="hidden w-56 items-center justify-end gap-2 sm:flex">
            <SiteHeaderSession />
          </div>
        </div>
      </div>
    </header>
  )
}
