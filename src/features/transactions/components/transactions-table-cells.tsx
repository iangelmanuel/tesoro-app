import { TableCell } from "@/components/ui/table"
import { formatCurrency, formatDate, formatTime } from "@/libs/format"

// Celdas compartidas por las filas de la tabla de Movimientos

/** Fecha y, debajo, la hora si el usuario la puso */
export function DateCell({
  date,
  time
}: {
  date: string
  time: string | null
}) {
  return (
    <TableCell className="text-muted-foreground">
      {formatDate(date)}
      {time && <span className="block text-xs">{formatTime(time)}</span>}
    </TableCell>
  )
}

/** Descripción con su icono opcional y, debajo, la nota */
export function DescriptionCell({
  title,
  note,
  icon: Icon
}: {
  title: string
  note: string | null
  icon?: React.ComponentType<{ className?: string }>
}) {
  // Sin truncar a una línea: el texto envuelve (máximo 3 líneas) y el
  // completo queda en `title` y en el diálogo de edición
  return (
    <TableCell className="max-w-72 min-w-56 whitespace-normal">
      <p
        title={title}
        className="flex items-start gap-2 font-medium"
      >
        {Icon && (
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="line-clamp-3 min-w-0 break-words">{title}</span>
      </p>
      {note && (
        <p
          title={note}
          className="line-clamp-3 text-xs break-words text-muted-foreground"
        >
          {note}
        </p>
      )}
    </TableCell>
  )
}

/**
 * Monto neutro (traspasos, ajustes, pagos con cuenta): gris, con el signo
 * leído como "más" o "menos" cuando lo hay
 */
export function NeutralAmountCell({
  sign,
  amount,
  currency
}: {
  sign: "+" | "−" | null
  amount: number
  currency: string
}) {
  return (
    <TableCell className="text-end font-medium text-muted-foreground tabular-nums">
      {sign ? (
        <>
          <span aria-hidden="true">{sign}</span>
          <span className="sr-only">{sign === "+" ? "más " : "menos "}</span>
        </>
      ) : null}
      {formatCurrency(amount, currency)}
    </TableCell>
  )
}

/** Cliente o proveedor y, debajo, el número de factura (Empresa) */
export function CounterpartyCell({
  counterparty,
  invoiceRef
}: {
  counterparty: string | null
  invoiceRef: string | null
}) {
  if (!counterparty && !invoiceRef) {
    return (
      <TableCell>
        <span className="text-muted-foreground">—</span>
      </TableCell>
    )
  }
  return (
    <TableCell className="max-w-48 whitespace-normal">
      {counterparty && <p className="truncate">{counterparty}</p>}
      {invoiceRef && (
        <p className="truncate text-sm text-muted-foreground">{invoiceRef}</p>
      )}
    </TableCell>
  )
}
