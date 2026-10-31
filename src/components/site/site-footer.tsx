import Link from "next/link"
import { Logo } from "@/components/brand/logo"
import { SITE, legalHref } from "@/config/site"

const PROJECT_LINKS = [
  { name: "Repositorio", href: SITE.repository.url },
  { name: "Reportar un problema", href: SITE.repository.issues },
  { name: "Seguridad", href: SITE.repository.security }
]

const SOCIAL_LINKS = [
  { name: "GitHub", href: SITE.social.github },
  { name: "LinkedIn", href: SITE.social.linkedin },
  { name: "X", href: SITE.social.x },
  { name: "Sitio web", href: SITE.social.website }
]

function FooterColumn({
  title,
  links
}: {
  title: string
  links: { name: string; href: string }[]
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">{title}</h2>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-3 sm:px-6 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3 sm:col-span-3 md:col-span-1">
          <Link
            href={SITE.routes.home}
            aria-label={`${SITE.info.name}, inicio`}
            className="w-fit"
          >
            <Logo />
          </Link>
          <p className="max-w-xs text-sm text-muted-foreground">
            {SITE.info.slogan}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Legal</h2>
          <ul className="flex flex-col gap-2">
            {SITE.legal.map((document) => (
              <li key={document.slug}>
                <Link
                  href={legalHref(document.slug)}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {document.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <FooterColumn
          title="Proyecto"
          links={PROJECT_LINKS}
        />
        <FooterColumn
          title="Redes"
          links={SOCIAL_LINKS}
        />
      </div>

      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {SITE.info.founded} {SITE.info.name}. Licencia {SITE.info.license}{" "}
            · v{SITE.info.version}
          </p>
          <p>
            Hecho por{" "}
            <a
              href={SITE.author.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {SITE.author.name}
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
