import { Card, cn } from "@heroui/react"

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
        "flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted",
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
  title: string
  /** Selector de rango u otra acción, a la derecha del título */
  action?: React.ReactNode
  /** Cifra principal bajo el título (monto ya formateado) */
  figure?: React.ReactNode
  /** Texto corto junto a la cifra ("este mes", "últimos 6 meses") */
  figureCaption?: string
  /** Series para la leyenda de la cabecera; con una sola no se muestra */
  legend?: LegendItem[]
  children: React.ReactNode
  className?: string
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
  className
}: ChartCardProps) {
  return (
    <Card className={cn("gap-4", className)}>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="text-sm font-medium text-muted">{title}</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {legend && <ChartLegendList items={legend} />}
            {action}
          </div>
        </div>
        {figure !== undefined && (
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              {figure}
            </span>
            {figureCaption && (
              <span className="text-sm text-muted">{figureCaption}</span>
            )}
          </p>
        )}
      </div>
      {/* Crece con la tarjeta: si la fila es más alta (columna lateral del
          Resumen), la gráfica ocupa el espacio en vez de dejarlo vacío */}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </Card>
  )
}
