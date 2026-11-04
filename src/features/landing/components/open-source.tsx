import { ArrowUpRightIcon } from "lucide-react"
import { SITE } from "@/config/site"
import { Reveal } from "./reveal"
import { SectionHeading } from "./section-heading"

const LINKS = [
  { label: "Ver el repositorio", href: SITE.repository.url },
  { label: "Reportar un problema", href: SITE.repository.issues },
  { label: "Cómo contribuir", href: SITE.repository.contributing }
] as const

// Código abierto: enlaces de texto, para no competir con "Crear cuenta"
export function OpenSource() {
  return (
    <section
      id="open-source"
      aria-labelledby="open-source-title"
      className="scroll-mt-16"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading
          id="open-source-title"
          title="Lee el código que cuida tus cifras"
          description={`${SITE.info.name} es de código abierto con licencia ${SITE.info.license}. Puedes auditar cómo se tratan tus datos, desplegar tu propia copia o proponer mejoras.`}
        />
        <Reveal>
          <ul className="flex flex-wrap gap-x-8 gap-y-3">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex min-h-11 items-center gap-1.5 rounded-md font-medium underline decoration-(--income)/40 decoration-2 underline-offset-6 transition-colors outline-none hover:decoration-(--income) focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {link.label}
                  <ArrowUpRightIcon
                    aria-hidden="true"
                    className="size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                  />
                </a>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
