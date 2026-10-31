import { cn } from "@/libs/utils"

type SectionHeadingProps = {
  id: string
  eyebrow: string
  title: string
  description?: string
  className?: string
}

// Encabezado común de las secciones de la landing. `id` va al <h2> para que
// la sección lo use en `aria-labelledby`
export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  className
}: SectionHeadingProps) {
  return (
    <div className={cn("flex max-w-2xl flex-col gap-3", className)}>
      <p className="text-sm font-medium text-brand">{eyebrow}</p>
      <h2
        id={id}
        className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
      >
        {title}
      </h2>
      {description && (
        <p className="text-base text-pretty text-muted-foreground sm:text-lg">
          {description}
        </p>
      )}
    </div>
  )
}
