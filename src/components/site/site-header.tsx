import Link from "next/link"
import { Logo } from "@/components/brand/logo"
import { SITE } from "@/config/site"
import { GitHubStars } from "./github-stars"
import { MobileNav } from "./mobile-nav"
import { SiteHeaderSession } from "./site-header-session"
import { SiteHeaderShell } from "./site-header-shell"

// Header público (SPEC 40): una sola línea, sin pastillas ni divisores. Logo,
// la navegación como texto, y a la derecha el repositorio con sus estrellas
// y la sesión. Sin selector de tema: las páginas públicas van siempre en
// claro. En móvil, la navegación y la sesión van en el cajón
export function SiteHeader() {
  return (
    <SiteHeaderShell>
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 md:grid-cols-[1fr_auto_1fr]">
        <Link
          href={SITE.routes.home}
          aria-label={`${SITE.info.name}, inicio`}
          className="w-fit rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
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
                  className="flex h-9 items-center rounded-full px-3 text-sm font-medium text-foreground outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center justify-end gap-1">
          <GitHubStars className="hidden h-9 px-2.5 text-foreground lg:inline-flex" />
          {/* Ancho fijo: con o sin sesión la isla no desplaza el header */}
          <div className="hidden w-64 items-center justify-end gap-1 sm:flex">
            <SiteHeaderSession size="compact" />
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
