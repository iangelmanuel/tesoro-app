import { cn } from "@heroui/react"

type IconComponent = React.ComponentType<{ className?: string }>

interface EmptyStateProps {
  icon: IconComponent
  /** Una frase: qué es lo que falta ("Aún no tienes movimientos") */
  title: string
  /** Una frase: qué hacer ("Registra el primero o importa un extracto") */
  description?: string
  /** La acción: el mismo botón o diálogo del acceso rápido del header */
  children?: React.ReactNode
  className?: string
}

// Estado vacío de una sección o página completa. Va sobre el fondo, así que
// trae su propia superficie (sin borde, como las tarjetas)
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-3xl bg-surface px-6 py-12 text-center",
        className
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-default text-muted">
        <Icon className="size-6" />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-base font-medium">{title}</p>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {children && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {children}
        </div>
      )}
    </div>
  )
}

interface CardEmptyProps {
  icon: IconComponent
  /** Qué falta, en una frase */
  message: string
  /** Qué hacer, en una frase (opcional) */
  hint?: string
  /** Botón o enlace de la acción */
  action?: React.ReactNode
}

// Estado vacío dentro de una tarjeta: compacto y sin caja propia
export function CardEmpty({
  icon: Icon,
  message,
  hint,
  action
}: CardEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
      <span className="flex size-10 items-center justify-center rounded-xl bg-default text-muted">
        <Icon className="size-5" />
      </span>
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">{message}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  )
}
