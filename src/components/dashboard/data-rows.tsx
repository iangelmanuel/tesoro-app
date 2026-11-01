import { cn } from "@heroui/react"
import { CARD_LIST, CARD_ROW } from "./surface"

// Patrón de tarjetas para tablas en `< 768 px`: cada fila lleva título y
// monto en la primera línea y una línea secundaria debajo. Se usa con
// `md:hidden` junto a la tabla (`hidden md:block`), que va en `display: none`
// para que los lectores de pantalla no lean las dos.

interface DataRowsProps {
  label: string
  className?: string
  children: React.ReactNode
}

export function DataRows({ label, className, children }: DataRowsProps) {
  return (
    <ul
      aria-label={label}
      className={cn(CARD_LIST, "md:hidden", className)}
    >
      {children}
    </ul>
  )
}

interface DataRowProps {
  /** Texto principal (hasta 2 líneas) */
  title: React.ReactNode
  /** Monto o cifra, en una sola línea y alineado a la derecha */
  value: React.ReactNode
  /** Color u otras clases del valor (`text-(--income)`) */
  valueClassName?: string
  /** Línea secundaria: fecha corta, categoría, etc. */
  meta?: React.ReactNode
}

export function DataRow({ title, value, valueClassName, meta }: DataRowProps) {
  return (
    <li className={cn(CARD_ROW, "flex flex-col gap-1.5")}>
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-2 min-w-0 font-medium break-words">{title}</p>
        <p
          className={cn(
            "shrink-0 text-right font-medium whitespace-nowrap tabular-nums",
            valueClassName
          )}
        >
          {value}
        </p>
      </div>
      {meta && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          {meta}
        </div>
      )}
    </li>
  )
}
