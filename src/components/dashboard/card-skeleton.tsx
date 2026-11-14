import { Card, Skeleton, cn } from "@heroui/react"
import { MonthSwitcherSkeleton } from "./month-switcher"

interface CardSkeletonProps {
  /** Alto y posición en la grilla, como la tarjeta que reemplaza */
  className?: string
  /** Líneas de contenido bajo el título (por defecto 2) */
  lines?: number
  /** La cabecera lleva el selector de mes (Gastos e Ingresos fijos) */
  withMonth?: boolean
}

/**
 * Placeholder de una tarjeta mientras carga: el mismo contenedor (superficie,
 * radio y padding de Card) con líneas de skeleton dentro, así la página no
 * cambia de forma al llegar los datos
 */
export function CardSkeleton({
  className,
  lines = 2,
  withMonth = false
}: CardSkeletonProps) {
  return (
    <Card
      aria-hidden="true"
      className={cn("gap-3", className)}
    >
      {withMonth ? (
        // Misma forma que CardHeading con control: título y píldora a la
        // derecha; en el teléfono la píldora baja a todo el ancho
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
          <Skeleton className="h-4 w-28 rounded-lg" />
          <MonthSwitcherSkeleton
            on="card"
            className="order-last md:order-none"
          />
        </div>
      ) : (
        <Skeleton className="h-4 w-28 rounded-lg" />
      )}
      <Skeleton className="h-7 w-40 rounded-lg" />
      {Array.from({ length: Math.max(lines - 1, 0) }, (_, index) => (
        <Skeleton
          key={index}
          // Anchos fijos: Math.random() no se permite al prerenderizar
          className={cn("h-3 rounded-lg", index % 2 ? "w-1/2" : "w-3/4")}
        />
      ))}
    </Card>
  )
}
