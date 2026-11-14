import type { Route } from "next"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { HelpKey } from "@/config/help"
import { HelpHint } from "./help-hint"

interface CardHeadingProps {
  title: string
  /** Ayuda (i) junto al título */
  help?: HelpKey
  /** Página con el detalle. Sin ella no hay enlace */
  href?: string
  /** Texto visible del enlace ("Ver todas") */
  linkLabel?: string
  /** Completa el enlace para lectores de pantalla ("las metas") */
  linkContext?: string
  /** Acción extra a la derecha (un botón pequeño) */
  action?: React.ReactNode
  /** Control de la tarjeta (el selector de mes): a la derecha desde 768 px;
   *  en el teléfono baja bajo el título a todo el ancho */
  control?: React.ReactNode
}

/**
 * Cabecera de las tarjetas del dashboard: título (h2), ayuda opcional y un
 * enlace discreto con chevron al detalle. Reemplaza los botones outline
 * "Ver todos" que competían con la acción principal
 */
export function CardHeading({
  title,
  help,
  href,
  linkLabel = "Ver todo",
  linkContext,
  action,
  control
}: CardHeadingProps) {
  return (
    <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-3">
      <div className="flex min-w-0 items-center gap-1">
        <h2 className="truncate text-sm font-medium text-muted">{title}</h2>
        {help && <HelpHint topic={help} />}
      </div>
      {control && (
        <div className="order-last w-full md:order-none md:ml-auto md:w-auto">
          {control}
        </div>
      )}
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {href && (
          <Link
            href={href as Route}
            className="inline-flex items-center gap-0.5 rounded-lg text-sm text-muted transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
          >
            {linkLabel}
            {linkContext && <span className="sr-only"> {linkContext}</span>}
            <ChevronRight
              aria-hidden="true"
              className="size-4"
            />
          </Link>
        )}
      </div>
    </div>
  )
}
