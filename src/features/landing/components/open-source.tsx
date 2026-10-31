import { BookOpenIcon, BugIcon, CodeIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SITE } from "@/config/site"
import { SectionHeading } from "./section-heading"

const LINKS = [
  {
    label: "Ver el repositorio",
    href: SITE.repository.url,
    icon: CodeIcon,
    variant: "default"
  },
  {
    label: "Reportar un problema",
    href: SITE.repository.issues,
    icon: BugIcon,
    variant: "outline"
  },
  {
    label: "Cómo contribuir",
    href: SITE.repository.contributing,
    icon: BookOpenIcon,
    variant: "outline"
  }
] as const

export function OpenSource() {
  return (
    <section
      id="open-source"
      aria-labelledby="open-source-title"
      className="scroll-mt-16 border-t"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading
          id="open-source-title"
          eyebrow="Código abierto"
          title={`${SITE.info.name} es de todos`}
          description={`El código está bajo licencia ${SITE.info.license}: puedes leerlo, auditar cómo se tratan tus datos, desplegar tu propia copia o proponer mejoras.`}
        />
        <div className="flex flex-wrap gap-3">
          {LINKS.map((link) => (
            <Button
              key={link.href}
              asChild
              size="lg"
              variant={link.variant}
              className="h-11 px-5"
            >
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <link.icon data-icon="inline-start" />
                {link.label}
              </a>
            </Button>
          ))}
        </div>
      </div>
    </section>
  )
}
