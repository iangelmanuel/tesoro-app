"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { CONTROL_SURFACE } from "@/components/dashboard/data/surface"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/libs/cn"

interface MonthSwitcherProps {
  /** "octubre 2026" o un texto especial ("Todos los meses") */
  label: string
  /** null deshabilita la flecha */
  onPrev: (() => void) | null
  /** Va al mes siguiente; null deshabilita la flecha */
  onNext: (() => void) | null
  /** Atenúa el control mientras navega */
  pending?: boolean
  /** Sobre qué va: el fondo de la página (bg-card, como la barra de
   *  Movimientos) o una tarjeta (un nivel más, para que no se pierda) */
  on?: "page" | "card"
  /** Clases del contenedor */
  className?: string
  "data-tour"?: string
}

/**
 * Selector de mes del dashboard (SPEC 40): una píldora con flecha anterior,
 * mes y flecha siguiente dentro. Lo usan Movimientos (`transactions-filters`)
 * y `MonthNav` (Gastos fijos, Ingresos fijos y Presupuestos). Alto de 44 px;
 * flechas de 44 px en el teléfono y 40 px en escritorio. El mes es texto,
 * no botón, y se anuncia con `aria-live`. En móvil ocupa el ancho que le dé
 * su contenedor (`w-full` por defecto, `md:w-auto`).
 */
export function MonthSwitcher({
  label,
  onPrev,
  onNext,
  pending = false,
  on = "page",
  className,
  "data-tour": dataTour
}: MonthSwitcherProps) {
  return (
    <div
      className={cn(
        "flex min-h-11 w-full min-w-0 items-center gap-0.5 rounded-3xl p-0.5 transition-opacity md:w-auto",
        on === "card" ? "bg-secondary" : CONTROL_SURFACE,
        pending && "opacity-60",
        className
      )}
      data-tour={dataTour}
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-11 md:touch-hitbox md:size-10"
        aria-label="Mes anterior"
        disabled={onPrev === null}
        onClick={() => onPrev?.()}
      >
        <ChevronLeft />
      </Button>
      <span
        aria-live="polite"
        className="min-w-0 flex-1 truncate px-1 text-center text-sm font-semibold first-letter:uppercase md:min-w-32 md:flex-none"
      >
        {label}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 md:touch-hitbox md:size-10"
        aria-label="Mes siguiente"
        disabled={onNext === null}
        onClick={() => onNext?.()}
      >
        <ChevronRight />
      </Button>
    </div>
  )
}

/** Hueco del selector: misma píldora, mismo alto y las flechas en su sitio */
export function MonthSwitcherSkeleton({
  on = "page",
  className
}: {
  on?: "page" | "card"
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex min-h-11 w-full min-w-0 items-center gap-0.5 rounded-3xl p-0.5 md:w-auto",
        on === "card" ? "bg-secondary" : CONTROL_SURFACE,
        className
      )}
    >
      <span className="size-11 md:size-10" />
      <span className="flex min-w-0 flex-1 justify-center px-1 md:min-w-32 md:flex-none">
        <Skeleton className="h-4 w-24" />
      </span>
      <span className="size-11 md:size-10" />
    </div>
  )
}
