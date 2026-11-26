import { CARD } from "@/components/dashboard/data/surface"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/libs/cn"
import { ChartSkeleton } from "./chart-skeleton"

export interface LegendItem {
  label: string
  /** Color CSS de la serie, un token: "var(--income)" */
  color: string
}

/** Leyenda compacta: punto de color + texto, en una línea */
export function ChartLegendList({
  items,
  className
}: {
  items: LegendItem[]
  className?: string
}) {
  if (items.length < 2) return null

  return (
    <ul
      aria-label="Leyenda"
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground",
        className
      )}
    >
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-1.5"
        >
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

interface ChartCardProps {
  /** Título de la tarjeta */
  title: string
  /** Selector de rango u otra acción, a la derecha del título */
  action?: React.ReactNode
  /** Cifra principal bajo el título (monto ya formateado) */
  figure?: React.ReactNode
  /** Texto corto junto a la cifra ("este mes", "últimos 6 meses") */
  figureCaption?: string
  /** Series para la leyenda de la cabecera; con una sola no se muestra */
  legend?: LegendItem[]
  /** La gráfica (o su estado vacío) */
  children: React.ReactNode
  /** Clases de la tarjeta */
  className?: string
  /** Ancla `data-tour` de los tutoriales guiados (SPEC 27) */
  tour?: string
}

/**
 * Tarjeta de gráfica: título con la leyenda y el selector de rango a la
 * derecha, cifra principal debajo y la gráfica. Sin borde, como el resto de
 * tarjetas.
 */
export function ChartCard({
  title,
  action,
  figure,
  figureCaption,
  legend,
  children,
  className,
  tour
}: ChartCardProps) {
  return (
    <ChartCardFrame
      className={className}
      data-tour={tour}
    >
      <div className="flex flex-col gap-1">
        <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {title}
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {legend && <ChartLegendList items={legend} />}
            {action}
          </div>
        </div>
        {figure !== undefined && (
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-2xl font-bold tracking-[-0.01em] tabular-nums">
              {figure}
            </span>
            {figureCaption && (
              <span className="text-sm text-muted-foreground">
                {figureCaption}
              </span>
            )}
          </p>
        )}
      </div>
      {/* Crece con la tarjeta: si la fila es más alta (columna lateral del
          Resumen), la gráfica ocupa el espacio en vez de dejarlo vacío */}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </ChartCardFrame>
  )
}

// Contenedor compartido por la tarjeta y su skeleton
function ChartCardFrame({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chart-card"
      className={cn(CARD, className)}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Hueco de ChartCard: misma cabecera (título y, si la hay, cifra) y el área
 * de la gráfica con la proporción de ChartContainer (16:9) o la altura que
 * le den, para que la página no salte al llegar los datos
 */
export function ChartCardSkeleton({
  figure = true,
  chartClassName,
  className
}: {
  /** La tarjeta real lleva cifra bajo el título */
  figure?: boolean
  /** Las mismas clases de tamaño que el ChartContainer real */
  chartClassName?: string
  className?: string
}) {
  return (
    <ChartCardFrame
      className={className}
      aria-hidden="true"
    >
      <div className="flex flex-col gap-1">
        <div className="flex min-h-7 items-center">
          <Skeleton className="h-4 w-32" />
        </div>
        {figure && (
          <div className="flex h-8 items-center">
            <Skeleton className="h-6 w-36" />
          </div>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <ChartSkeleton className={chartClassName} />
      </div>
    </ChartCardFrame>
  )
}
