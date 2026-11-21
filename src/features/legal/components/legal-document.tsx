import { formatDate } from "@/libs/format"

export type LegalSection = {
  id: string // ancla kebab-case
  title: string
  content: React.ReactNode
}

export type LegalContent = {
  description: string
  sections: LegalSection[]
}

type LegalDocumentProps = {
  title: string
  updatedAt: string
  sections: LegalSection[]
}

// Estilos del cuerpo: párrafos, listas y enlaces de cada sección
const BODY_CLASSES =
  "flex flex-col gap-4 text-pretty text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-2 [&_ol]:pl-5 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5"

export function LegalDocument({
  title,
  updatedAt,
  sections
}: LegalDocumentProps) {
  return (
    <article className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <header className="flex flex-col gap-3 border-b pb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">
          Última actualización:{" "}
          <time dateTime={updatedAt}>{formatDate(updatedAt)}</time>
        </p>
      </header>

      <div className="grid gap-10 pt-10 lg:grid-cols-[16rem_1fr] lg:gap-16">
        <nav
          aria-label="Contenido"
          className="lg:sticky lg:top-24 lg:self-start"
        >
          <h2 className="mb-3 text-sm font-medium">Contenido</h2>
          <ol className="flex flex-col gap-2 text-sm">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {index + 1}. {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex min-w-0 flex-col gap-10">
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              className="scroll-mt-24"
            >
              <h2
                id={`${section.id}-title`}
                className="mb-4 text-xl font-semibold tracking-tight"
              >
                {index + 1}. {section.title}
              </h2>
              <div className={BODY_CLASSES}>{section.content}</div>
            </section>
          ))}
        </div>
      </div>
    </article>
  )
}
