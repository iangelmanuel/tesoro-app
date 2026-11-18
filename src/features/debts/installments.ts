import { shiftMonth } from "@/libs/dates"

// Compras y avances de tarjeta a cuotas (SPEC 42, parte 2). Cada compra a N
// cuotas aporta monto / N al pago de los N ciclos siguientes a su fecha. La
// suma por ciclo la calcula debt_overview; aquí va la misma regla para
// mostrar en qué cuota va cada compra.

/** Cuotas de una compra o avance: de 1 a 48 */
export const MAX_INSTALLMENTS = 48

const pad2 = (value: number) => String(value).padStart(2, "0")

/** Día `day` del mes YYYY-MM; si no existe, el último día */
function dayInMonth(month: string, day: number) {
  const [year, monthNumber] = month.split("-").map(Number)
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return `${month}-${pad2(Math.min(day, lastDay))}`
}

/**
 * Mes YYYY-MM del vencimiento en el que se paga la primera cuota de una
 * compra del día `occurredOn`. Con día de corte: el primer vencimiento
 * posterior al primer corte que incluye la compra. Sin él: el primer
 * vencimiento posterior a la compra. Misma regla que
 * card_installment_start en la base de datos.
 */
export function installmentStartMonth(
  occurredOn: string,
  dueDay: number,
  closingDay: number | null
) {
  let month = occurredOn.slice(0, 7)
  let after = occurredOn

  if (closingDay !== null) {
    if (dayInMonth(month, closingDay) < occurredOn) {
      month = shiftMonth(month, 1)
    }
    after = dayInMonth(month, closingDay)
  }

  if (dayInMonth(month, dueDay) <= after) {
    month = shiftMonth(month, 1)
  }
  return month
}

/** Meses de `from` a `to` (YYYY-MM): positivo si `to` es posterior */
function monthsBetween(from: string, to: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number)
  const [toYear, toMonth] = to.split("-").map(Number)
  return (toYear - fromYear) * 12 + (toMonth - fromMonth)
}

export type InstallmentProgress =
  /** La cuota `current` de `total` se paga en el próximo vencimiento */
  | { kind: "due"; current: number; total: number }
  /** Aún no empieza: la primera cuota va en un vencimiento posterior */
  | { kind: "upcoming"; total: number }
  /** Ya se cobraron todas las cuotas */
  | { kind: "done"; total: number }

/**
 * En qué cuota va una compra respecto al próximo vencimiento de la tarjeta
 * (`nextDueOn`). null si no tiene cuotas o la tarjeta no tiene vencimiento.
 */
export function installmentProgress(
  entry: { occurred_on: string; installments: number | null },
  card: { due_day: number | null; closing_day: number | null },
  nextDueOn: string | null
): InstallmentProgress | null {
  if (entry.installments === null || card.due_day === null || !nextDueOn) {
    return null
  }

  const total = entry.installments
  const start = installmentStartMonth(
    entry.occurred_on,
    card.due_day,
    card.closing_day
  )
  const index = monthsBetween(start, nextDueOn.slice(0, 7))

  if (index < 0) return { kind: "upcoming", total }
  if (index >= total) return { kind: "done", total }
  return { kind: "due", current: index + 1, total }
}

/** "a 3 cuotas · 2 de 3", "a 3 cuotas · pagada" o "a 3 cuotas" */
export function installmentLabel(
  installments: number,
  progress: InstallmentProgress | null
) {
  const base = `a ${installments} ${installments === 1 ? "cuota" : "cuotas"}`
  if (progress?.kind === "due") {
    return `${base} · ${progress.current} de ${progress.total}`
  }
  if (progress?.kind === "done") {
    return `${base} · pagada`
  }
  return base
}
