import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/libs/cn"
import { MonthSwitcherSkeleton } from "./month-switcher"
import { CARD } from "./surface"

interface CardSkeletonProps {
  /** Alto y posición en la grilla, como la tarjeta que reemplaza */
  className?: string
  /** Líneas de contenido bajo el título (por defecto 2) */
  lines?: number
  /** La cabecera lleva el selector de mes (Gastos e Ingresos fijos) */
  withMonth?: boolean
}

/**
 * Placeholder genérico de una tarjeta mientras carga: el mismo contenedor
 * (superficie, radio y padding de la tarjeta) con líneas de skeleton dentro.
 *
 * En retiro (SPEC 51 §6): el código nuevo usa el …Skeleton de cada
 * componente, con su mismo contenedor. Este queda para las pantallas aún no
 * migradas y se borra en SPEC 53
 */
export function CardSkeleton({
  className,
  lines = 2,
  withMonth = false
}: CardSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(CARD, "gap-3", className)}
    >
      {withMonth ? (
        // Misma forma que CardHeading con control: título y píldora a la
        // derecha; en el teléfono la píldora baja a todo el ancho
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
          <Skeleton className="h-4 w-28" />
          <MonthSwitcherSkeleton
            on="card"
            className="order-last md:order-none"
          />
        </div>
      ) : (
        <Skeleton className="h-4 w-28" />
      )}
      <Skeleton className="h-7 w-40" />
      {Array.from({ length: Math.max(lines - 1, 0) }, (_, index) => (
        <Skeleton
          key={index}
          // Anchos fijos: Math.random() no se permite al prerenderizar
          className={cn("h-3", index % 2 ? "w-1/2" : "w-3/4")}
        />
      ))}
    </div>
  )
}
