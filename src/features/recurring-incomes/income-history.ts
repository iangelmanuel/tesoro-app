import { addDays } from "@/libs/dates"
import {
  type IncomeOccurrenceStatus,
  getIncomeOccurrenceStatus,
  incomeDueDates,
  occurrenceRemaining
} from "./occurrences"
import { futureWindowEnd } from "./receipt"
import type { IncomeFrequency } from "./schemas"

// Historial del Sheet de un ingreso fijo (SPEC 38). Puro: la consulta está en
// history-queries.ts y el Sheet (cliente) importa los tipos.

/** Un movimiento que cubre (toda o parte de) una ocurrencia */
export interface IncomeReceipt {
  transactionId: string
  occurredOn: string
  description: string
  /** Lo que este movimiento asignó a la ocurrencia */
  amount: number
}

/** Ocurrencia del Sheet de un ingreso fijo, con los movimientos que la cubren */
export interface IncomeHistoryRow {
  dueOn: string
  amount: number
  receivedAmount: number
  remaining: number
  status: IncomeOccurrenceStatus
  receipts: IncomeReceipt[]
}

export interface RecurringIncomeHistory {
  /** Desde `starts_on` hasta hoy más la próxima, la más reciente primero */
  occurrences: IncomeHistoryRow[]
  /** Hay ocurrencias más antiguas que `limit` */
  hasMore: boolean
  /** Recibido en ocurrencias del año actual */
  receivedThisYear: number
  /** Lo que falta de las ocurrencias vencidas o de hoy */
  dueToDate: number
}

/** Calendario del ingreso fijo que pide el historial */
export interface IncomeHistorySchedule {
  amount: number
  frequency: IncomeFrequency
  day_of_month: number | null
  second_day_of_month: number | null
  month_of_year: number | null
  day_of_week: number | null
  interval_days: number | null
  starts_on: string
  ends_on: string | null
}

/** Una asignación de un cobro a una ocurrencia, con su movimiento */
export interface IncomeHistoryAllocation {
  due_on: string
  /** `numeric` de Postgres: puede llegar como texto */
  amount: number | string
  transaction: {
    id: string
    occurred_on: string
    description: string
    day_position: number
    created_at: string
  }
}

/**
 * Ocurrencias desde `starts_on` hasta `today` más la próxima, la más
 * reciente primero, con lo recibido y los movimientos que cubren cada una
 * (hasta `limit`). Las asignaciones cuya fecha ya no calza con el calendario
 * (la fuente cambió de días) se muestran en su fecha.
 */
export function buildIncomeHistory(
  schedule: IncomeHistorySchedule,
  allocations: IncomeHistoryAllocation[],
  today: string,
  limit: number
): RecurringIncomeHistory {
  const next = incomeDueDates(
    schedule,
    addDays(today, 1),
    futureWindowEnd(schedule, today)
  )[0]
  const dates = new Set(incomeDueDates(schedule, schedule.starts_on, today))
  if (next !== undefined) {
    dates.add(next)
  }

  // Por fecha y, dentro del día, en el orden manual de Movimientos (SPEC 19
  // y 45): así los cobros del mismo día quedan juntos y se pueden reordenar
  const sortedAllocations = [...allocations].sort(
    (a, b) =>
      a.transaction.occurred_on.localeCompare(b.transaction.occurred_on) ||
      a.transaction.day_position - b.transaction.day_position ||
      b.transaction.created_at.localeCompare(a.transaction.created_at)
  )
  const receiptsByDate = new Map<string, IncomeReceipt[]>()
  for (const allocation of sortedAllocations) {
    dates.add(allocation.due_on)
    const list = receiptsByDate.get(allocation.due_on) ?? []
    list.push({
      transactionId: allocation.transaction.id,
      occurredOn: allocation.transaction.occurred_on,
      description: allocation.transaction.description,
      amount: Number(allocation.amount)
    })
    receiptsByDate.set(allocation.due_on, list)
  }

  const year = today.slice(0, 4)
  let receivedCents = 0
  let dueCents = 0
  const occurrences = [...dates]
    .sort((a, b) => b.localeCompare(a))
    .map((dueOn): IncomeHistoryRow => {
      const receipts = receiptsByDate.get(dueOn) ?? []
      const occurrence = {
        due_on: dueOn,
        amount: schedule.amount,
        received_amount:
          receipts.reduce(
            (total, row) => total + Math.round(row.amount * 100),
            0
          ) / 100
      }
      const remaining = occurrenceRemaining(occurrence)
      if (dueOn.startsWith(year)) {
        receivedCents += Math.round(occurrence.received_amount * 100)
      }
      if (dueOn <= today) {
        dueCents += Math.round(remaining * 100)
      }
      return {
        dueOn,
        amount: schedule.amount,
        receivedAmount: occurrence.received_amount,
        remaining,
        status: getIncomeOccurrenceStatus(occurrence, today),
        receipts
      }
    })

  const visible = occurrences.slice(0, Math.max(1, limit))
  return {
    occurrences: visible,
    hasMore: occurrences.length > visible.length,
    receivedThisYear: receivedCents / 100,
    dueToDate: dueCents / 100
  }
}

/** La ocurrencia abierta más antigua: las atrasadas primero */
export function nextOpenOccurrence<T extends Pick<IncomeHistoryRow, "status">>(
  occurrences: T[]
) {
  return occurrences.findLast((row) => row.status !== "received") ?? null
}

/**
 * Ocurrencias por página del Sheet de un ingreso fijo: 31 en la diaria (un
 * mes), 12 en las demás. "Ver más" suma otra página.
 */
export function incomeHistoryPageSize(frequency: IncomeFrequency) {
  return frequency === "daily" ? 31 : 12
}
