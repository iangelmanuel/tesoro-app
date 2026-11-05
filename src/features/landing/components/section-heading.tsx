import { cn } from "@heroui/react"
import { Reveal } from "./reveal"

type SectionHeadingProps = {
  id: string
  title: string
  description?: string
  className?: string
}

// Encabezado común de las secciones de la landing. `id` va al <h2> para que
// la sección lo use en `aria-labelledby`. Sin eyebrow: el título se sostiene
// solo (SPEC 24)
export function SectionHeading({
  id,
  title,
  description,
  className
}: SectionHeadingProps) {
  return (
    <Reveal className={cn("flex max-w-2xl flex-col gap-3", className)}>
      <h2
        id={id}
        className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
      >
        {title}
      </h2>
      {description && (
        <p className="text-base text-pretty text-muted sm:text-lg">
          {description}
        </p>
      )}
    </Reveal>
  )
}
