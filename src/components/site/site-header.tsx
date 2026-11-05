import Link from "next/link"
import { Logo } from "@/components/brand/logo"
import { SITE } from "@/config/site"
import { GitHubStars } from "./github-stars"
import { MobileNav } from "./mobile-nav"
import { SiteHeaderSession } from "./site-header-session"
import { SiteHeaderShell } from "./site-header-shell"
import { SiteThemeToggle } from "./site-theme-toggle"

// Header público: logo, navegación en una pastilla al centro y, a la derecha,
// el repositorio con sus estrellas, el tema y la sesión
export function SiteHeader() {
  return (
    <SiteHeaderShell>
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 md:grid-cols-[1fr_auto_1fr]">
        <Link
          href={SITE.routes.home}
          aria-label={`${SITE.info.name}, inicio`}
          className="w-fit rounded-md focus-visible:ring-3 focus-visible:ring-focus/50 focus-visible:outline-none"
        >
          <Logo />
        </Link>

        <nav
          aria-label="Principal"
          className="hidden md:block"
        >
          <ul className="flex items-center gap-0.5 rounded-full bg-surface/70 p-1 shadow-(--surface-shadow) backdrop-blur">
            {SITE.navigation.main.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex h-9 items-center rounded-full px-4 text-sm text-muted transition-colors hover:bg-default hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center justify-end gap-1">
          <GitHubStars className="hidden lg:inline-flex" />
          <SiteThemeToggle />
          <span
            aria-hidden="true"
            className="mx-1 hidden h-6 w-px bg-separator sm:block"
          />
          {/* Ancho fijo: con o sin sesión la isla no desplaza el header */}
          <div className="hidden w-68 items-center justify-end gap-1 sm:flex">
            <SiteHeaderSession />
          </div>
          <MobileNav>
            <SiteHeaderSession />
            <GitHubStars className="justify-center" />
          </MobileNav>
        </div>
      </div>
    </SiteHeaderShell>
  )
}
