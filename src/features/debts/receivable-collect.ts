import {
  type Allocation,
  type Period,
  allocateOldestFirst
} from "@/libs/allocate"
import { shiftMonth } from "@/libs/dates"
import { ALLOCATION_EXCEEDS_END, ALLOCATION_FUTURE_LIMIT } from "./errors"
import type { Debt, DebtEntry } from "./queries"
import {
  installmentAmountFor,
  lastPeriodOn,
  periodOf,
  receivableInstallments,
  summarizeInstallments
} from "./receivable-schedule"
import type { ReceivableSchedule } from "./schemas"

// Cobro de una cuenta por cobrar (SPEC 39). Funciones puras para el
// formulario compartido del tab Me deben y del Sheet: la regla de reparto es
// la de allocate_debt_entry, que es la que manda al guardar.

/** Meses por delante del actual que cubre un cobro de una indefinida */
export const FUTURE_MONTH_LIMIT = 12

/** Atajos de "Varios meses" */
export const MONTH_SHORTCUTS = [2, 3, 6] as const

/** Cuota de una mensual con lo que le falta (0 si está pagada) */
export interface CollectPeriod {
  period_on: string // YYYY-MM-01
  remaining: number
}

/** Cuenta por cobrar activa con lo que necesita el formulario de cobro */
export interface CollectableReceivable {
  id: string
  name: string
  schedule: ReceivableSchedule
  /** Lo que falta en total; null en una mensual indefinida (sin saldo total) */
  balance: number | null
  /**
   * Mensual: cuotas desde la primera hasta la última o hasta
   * FUTURE_MONTH_LIMIT meses después del actual (indefinida). Vacío en una
   * de cobro único
   */
  periods: CollectPeriod[]
  /** Mensual: cuotas sin cubrir hasta el mes actual y lo que suman */
  owedCount: number
  owed: number
}

const toCents = (value: number) => Math.round(value * 100)

/** Último mes (YYYY-MM-01) en el que puede caer un cobro */
function capPeriod(
  debt: Pick<Debt, "starts_on" | "term_months">,
  today: string
) {
  if (debt.starts_on !== null && debt.term_months !== null) {
    return lastPeriodOn({
      starts_on: debt.starts_on,
      term_months: debt.term_months
    })
  }
  return `${shiftMonth(today.slice(0, 7), FUTURE_MONTH_LIMIT)}-01`
}

/**
 * Cuotas de una mensual con lo que falta en cada una: valor del mes menos lo
 * asignado por todos los abonos (sin `excludeEntryId`, al editarlo)
 */
export function collectPeriods(
  debt: Pick<
    Debt,
    "starts_on" | "term_months" | "installment" | "installment_history"
  >,
  entries: readonly Pick<DebtEntry, "id" | "kind" | "allocations">[],
  today: string,
  excludeEntryId?: string
): CollectPeriod[] {
  if (debt.starts_on === null || debt.installment === null) {
    return []
  }

  const paid = new Map<string, number>()
  for (const entry of entries) {
    if (entry.kind !== "payment" || entry.id === excludeEntryId) continue
    for (const allocation of entry.allocations) {
      paid.set(
        allocation.period_on,
        (paid.get(allocation.period_on) ?? 0) + toCents(allocation.amount)
      )
    }
  }

  const receivable = {
    installment: debt.installment,
    installment_history: debt.installment_history
  }
  const last = capPeriod(debt, today)
  const periods: CollectPeriod[] = []
  for (
    let period = periodOf(debt.starts_on);
    last !== null && period <= last;
    period = `${shiftMonth(period.slice(0, 7), 1)}-01`
  ) {
    const expected = toCents(installmentAmountFor(receivable, period))
    periods.push({
      period_on: period,
      remaining: Math.max(0, expected - (paid.get(period) ?? 0)) / 100
    })
  }
  return periods
}

/** Datos del formulario de cobro para una cuenta por cobrar activa */
export function toCollectableReceivable(
  debt: Debt,
  entries: readonly DebtEntry[],
  today: string
): CollectableReceivable {
  if (debt.schedule !== "monthly") {
    return {
      id: debt.id,
      name: debt.name,
      schedule: "once",
      balance: debt.balance,
      periods: [],
      owedCount: 0,
      owed: 0
    }
  }

  const installments = receivableInstallments(debt, entries, today)
  const currentPeriod = periodOf(today)
  const owedCount = installments.filter(
    (item) => item.period_on <= currentPeriod && item.remaining > 0
  ).length

  return {
    id: debt.id,
    name: debt.name,
    schedule: "monthly",
    balance: debt.term_months === null ? null : debt.balance,
    periods: collectPeriods(debt, entries, today),
    owedCount,
    owed: summarizeInstallments(installments, today).owed
  }
}

/** Cuotas sin cubrir, de la más antigua a la más reciente */
export function openPeriods(receivable: CollectableReceivable) {
  return receivable.periods.filter((period) => period.remaining > 0)
}

export interface CollectPreview {
  /** Meses que el cobro cubre completos */
  covered: string[]
  /** Cuota que queda abonada, con lo que recibe y lo que le sigue faltando */
  partial: (Allocation & { missing: number }) | null
  /** Mensaje si sobra monto; null si el reparto cabe */
  error: string | null
}

/** Reparto de `amount` desde la cuota no pagada más antigua ("Varios meses") */
export function previewCollection(
  receivable: CollectableReceivable,
  amount: number
): CollectPreview {
  const periods: Period[] = receivable.periods.map((period) => ({
    key: period.period_on,
    due: period.remaining
  }))
  const { allocations, leftover } = allocateOldestFirst(periods, amount)
  const dueByKey = new Map(periods.map((period) => [period.key, period.due]))

  const covered: string[] = []
  let partial: CollectPreview["partial"] = null
  for (const allocation of allocations) {
    const due = dueByKey.get(allocation.key) ?? 0
    if (allocation.amount < due) {
      partial = {
        ...allocation,
        missing: (toCents(due) - toCents(allocation.amount)) / 100
      }
    } else {
      covered.push(allocation.key)
    }
  }

  return {
    covered,
    partial,
    error:
      leftover > 0
        ? receivable.balance === null
          ? ALLOCATION_FUTURE_LIMIT
          : ALLOCATION_EXCEEDS_END
        : null
  }
}

/** Lo que falta de las `months` cuotas sin cubrir más antiguas; null si no hay tantas */
export function amountForMonths(
  receivable: CollectableReceivable,
  months: number
) {
  const open = openPeriods(receivable)
  if (open.length < months) {
    return null
  }
  return (
    open
      .slice(0, months)
      .reduce((total, period) => total + toCents(period.remaining), 0) / 100
  )
}

const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic"
] as const

/** "sep", o "ene 2027" si no es del año de `today` */
export function shortMonth(period: string, today: string) {
  const name = MONTHS[Number(period.slice(5, 7)) - 1]
  return period.slice(0, 4) === today.slice(0, 4)
    ? name
    : `${name} ${period.slice(0, 4)}`
}

/** "sep, oct y nov"; más de 4, como rango ("6 meses, de sep a feb 2027") */
export function describeMonths(periods: string[], today: string) {
  const names = periods.map((period) => shortMonth(period, today))
  if (names.length > 4) {
    return `${names.length} meses, de ${names[0]} a ${names[names.length - 1]}`
  }
  if (names.length <= 1) {
    return names.join("")
  }
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`
}
