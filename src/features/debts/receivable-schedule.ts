import type { Tone } from "@/components/dashboard/tone"
import { monthRange, shiftMonth } from "@/libs/dates"

// Cuotas de una cuenta por cobrar mensual (SPEC 28 y 29). El estado de cada
// cuota no se guarda: depende de sus abonos y de la fecha de hoy. Todas las
// fechas son YYYY-MM-DD en America/Bogota; como texto ISO se comparan en
// orden cronológico.

export type InstallmentStatus = "paid" | "partial" | "pending" | "overdue"

export const INSTALLMENT_STATUS: Record<
  InstallmentStatus,
  {
    label: string
    tone: Extract<Tone, "success" | "warning" | "neutral" | "danger">
  }
> = {
  paid: { label: "Pagada", tone: "success" },
  partial: { label: "Abonada", tone: "warning" },
  pending: { label: "Pendiente", tone: "neutral" },
  overdue: { label: "Atrasada", tone: "danger" }
}

export interface InstallmentEntry {
  id: string
  amount: number
  occurred_on: string
}

/** Valor anterior de la cuota: hasta `through_period` valía `amount` */
export interface InstallmentRate {
  through_period: string // YYYY-MM-01
  amount: number
}

export interface Installment {
  period_on: string // YYYY-MM-01
  due_on: string // día de pago ajustado al mes
  status: InstallmentStatus
  /** Valor de la cuota ese mes */
  expected: number
  /** Suma de sus abonos */
  paid: number
  /** Lo que falta: 0 si está pagada */
  remaining: number
  /** Abonos de la cuota, del más antiguo al más reciente */
  entries: InstallmentEntry[]
}

/** Campos de la cuenta por cobrar mensual que usa el cálculo */
export interface MonthlyReceivable {
  starts_on: string
  due_day: number
  term_months: number | null
  /** Valor actual de la cuota */
  installment: number
  /** Valores anteriores (solo indefinidas) */
  installment_history?: readonly InstallmentRate[]
}

/** Abono con la cuota que cobra */
export interface PeriodEntry extends InstallmentEntry {
  period_on: string | null
}

const roundCents = (value: number) => Math.round(value * 100) / 100

/** Primer día del mes de una fecha YYYY-MM-DD */
export function periodOf(date: string) {
  return `${date.slice(0, 7)}-01`
}

/**
 * Fecha de pago de la cuota del mes `periodOn`: el día de pago, o el último
 * día del mes si el mes es más corto (31 → 30 de abril, 28 o 29 de febrero)
 */
export function installmentDueOn(periodOn: string, dueDay: number) {
  const { to } = monthRange(periodOn.slice(0, 7))
  const lastDay = Number(to.slice(8))
  const day = Math.min(dueDay, lastDay)
  return `${periodOn.slice(0, 7)}-${String(day).padStart(2, "0")}`
}

/** Mes (YYYY-MM-01) de la última cuota, o null si es indefinida */
export function lastPeriodOn(
  receivable: Pick<MonthlyReceivable, "starts_on" | "term_months">
) {
  if (receivable.term_months === null) {
    return null
  }
  const first = receivable.starts_on.slice(0, 7)
  return `${shiftMonth(first, receivable.term_months - 1)}-01`
}

/**
 * Valor de la cuota del mes `periodOn`: el valor anterior con el menor
 * `through_period` que lo cubre o, si ninguno, el valor actual
 */
export function installmentAmountFor(
  receivable: Pick<MonthlyReceivable, "installment" | "installment_history">,
  periodOn: string
) {
  let match: InstallmentRate | null = null
  for (const rate of receivable.installment_history ?? []) {
    if (
      rate.through_period >= periodOn &&
      (match === null || rate.through_period < match.through_period)
    ) {
      match = rate
    }
  }
  return match?.amount ?? receivable.installment
}

export function getInstallmentStatus(
  dueOn: string,
  expected: number,
  paid: number,
  today: string
): InstallmentStatus {
  if (paid >= expected) {
    return "paid"
  }
  if (paid > 0) {
    return "partial"
  }
  return dueOn < today ? "overdue" : "pending"
}

/**
 * Cuotas en orden cronológico, desde el mes de inicio hasta el mes siguiente
 * al actual o la última cuota, lo que llegue primero. Si hay un cobro de una
 * cuota posterior (un adelanto), la lista llega hasta ella. Siempre incluye
 * al menos la primera cuota, aunque el cobro empiece en el futuro.
 */
export function buildInstallments(
  receivable: MonthlyReceivable,
  entries: readonly PeriodEntry[],
  today: string
): Installment[] {
  const firstMonth = receivable.starts_on.slice(0, 7)
  const last = lastPeriodOn(receivable)

  const byPeriod = new Map<string, InstallmentEntry[]>()
  for (const entry of entries) {
    if (entry.period_on !== null) {
      const list = byPeriod.get(entry.period_on) ?? []
      list.push({
        id: entry.id,
        amount: entry.amount,
        occurred_on: entry.occurred_on
      })
      byPeriod.set(entry.period_on, list)
    }
  }

  let endMonth = shiftMonth(today.slice(0, 7), 1)
  if (last !== null && last.slice(0, 7) < endMonth) {
    endMonth = last.slice(0, 7)
  }
  for (const period of byPeriod.keys()) {
    const month = period.slice(0, 7)
    if (month > endMonth && (last === null || period <= last)) {
      endMonth = month
    }
  }
  if (endMonth < firstMonth) {
    endMonth = firstMonth
  }

  const installments: Installment[] = []
  for (
    let month = firstMonth;
    month <= endMonth;
    month = shiftMonth(month, 1)
  ) {
    const periodOn = `${month}-01`
    const dueOn = installmentDueOn(periodOn, receivable.due_day)
    const periodEntries = (byPeriod.get(periodOn) ?? []).sort((a, b) =>
      a.occurred_on.localeCompare(b.occurred_on)
    )
    const expected = installmentAmountFor(receivable, periodOn)
    const paid = roundCents(
      periodEntries.reduce((sum, entry) => sum + entry.amount, 0)
    )

    installments.push({
      period_on: periodOn,
      due_on: dueOn,
      status: getInstallmentStatus(dueOn, expected, paid, today),
      expected,
      paid,
      remaining: Math.max(0, roundCents(expected - paid)),
      entries: periodEntries
    })
  }

  return installments
}

/**
 * Resumen para la tarjeta: cuotas vencidas sin cubrir (atrasadas o abonadas
 * con la fecha de pago ya pasada), lo que se debe hasta el mes actual y la
 * próxima cuota sin cubrir
 */
export function summarizeInstallments(
  installments: readonly Installment[],
  today: string
) {
  const currentPeriod = periodOf(today)
  const overdue = installments.filter(
    (item) => item.remaining > 0 && item.due_on < today
  )
  const owed = roundCents(
    installments
      .filter((item) => item.period_on <= currentPeriod)
      .reduce((sum, item) => sum + item.remaining, 0)
  )
  const next =
    installments.find((item) => item.remaining > 0 && item.due_on >= today) ??
    null

  return { overdueCount: overdue.length, owed, next }
}

/** Cuenta por cobrar con los campos (nulables) que trae la consulta */
interface MonthlyReceivableRow {
  starts_on: string | null
  due_day: number | null
  term_months: number | null
  installment: number | null
  installment_history: readonly InstallmentRate[]
}

/** Abonos de una cuenta por cobrar como los trae la consulta */
interface DebtEntryRow extends PeriodEntry {
  kind: string
}

/** Abonos de las entradas de una cuenta por cobrar */
export function periodPayments(entries: readonly DebtEntryRow[]) {
  return entries
    .filter((entry) => entry.kind === "payment")
    .map(({ id, amount, occurred_on, period_on }) => ({
      id,
      amount,
      occurred_on,
      period_on
    }))
}

/**
 * Cuotas de una cuenta por cobrar mensual a partir de la fila de la consulta
 * y sus entradas. Sin inicio, día de pago o valor, no hay cuotas.
 */
export function receivableInstallments(
  debt: MonthlyReceivableRow,
  entries: readonly DebtEntryRow[],
  today: string
) {
  if (
    debt.starts_on === null ||
    debt.due_day === null ||
    debt.installment === null
  ) {
    return []
  }
  return buildInstallments(
    {
      starts_on: debt.starts_on,
      due_day: debt.due_day,
      term_months: debt.term_months,
      installment: debt.installment,
      installment_history: debt.installment_history
    },
    periodPayments(entries),
    today
  )
}

/**
 * Lo que deben, hasta el mes actual, las mensuales indefinidas activas (no
 * tienen saldo total, así que "Te deben" no las cuenta por saldo)
 */
export function owedOnOpenEnded(
  debts: readonly (MonthlyReceivableRow & {
    id: string
    kind: string
    status: string
    schedule: string | null
  })[],
  entries: Readonly<Record<string, readonly DebtEntryRow[]>>,
  today: string
) {
  return roundCents(
    debts
      .filter(
        (debt) =>
          debt.kind === "receivable" &&
          debt.status === "active" &&
          debt.schedule === "monthly" &&
          debt.term_months === null
      )
      .reduce(
        (sum, debt) =>
          sum +
          summarizeInstallments(
            receivableInstallments(debt, entries[debt.id] ?? [], today),
            today
          ).owed,
        0
      )
  )
}

/** Cobrado en el año de `today` (por fecha del cobro) */
export function collectedInYear(
  entries: readonly PeriodEntry[],
  today: string
) {
  const year = today.slice(0, 4)
  return entries
    .filter((entry) => entry.occurred_on.startsWith(year))
    .reduce((sum, entry) => sum + entry.amount, 0)
}
