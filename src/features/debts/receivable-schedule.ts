import type { Tone } from "@/components/dashboard/tone"
import { monthRange, shiftMonth } from "@/libs/dates"

// Cuotas de una cuenta por cobrar mensual (SPEC 28). El estado de cada cuota
// no se guarda: depende de la fecha de hoy. Todas las fechas son YYYY-MM-DD
// en America/Bogota; como texto ISO se comparan en orden cronológico.

export type InstallmentStatus = "paid" | "pending" | "overdue"

export const INSTALLMENT_STATUS: Record<
  InstallmentStatus,
  { label: string; tone: Tone }
> = {
  paid: { label: "Pagada", tone: "success" },
  pending: { label: "Pendiente", tone: "neutral" },
  overdue: { label: "Atrasada", tone: "danger" }
}

export interface InstallmentEntry {
  id: string
  amount: number
  occurred_on: string
}

export interface Installment {
  period_on: string // YYYY-MM-01
  due_on: string // día de pago ajustado al mes
  status: InstallmentStatus
  entry: InstallmentEntry | null
}

/** Campos de la cuenta por cobrar mensual que usa el cálculo */
export interface MonthlyReceivable {
  starts_on: string
  due_day: number
  term_months: number | null
}

/** Abono con la cuota que cobra */
export interface PeriodEntry extends InstallmentEntry {
  period_on: string | null
}

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
export function lastPeriodOn(receivable: MonthlyReceivable) {
  if (receivable.term_months === null) {
    return null
  }
  const first = receivable.starts_on.slice(0, 7)
  return `${shiftMonth(first, receivable.term_months - 1)}-01`
}

export function getInstallmentStatus(
  dueOn: string,
  entry: InstallmentEntry | null,
  today: string
): InstallmentStatus {
  if (entry !== null) {
    return "paid"
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

  const byPeriod = new Map<string, InstallmentEntry>()
  for (const entry of entries) {
    if (entry.period_on !== null) {
      byPeriod.set(entry.period_on, {
        id: entry.id,
        amount: entry.amount,
        occurred_on: entry.occurred_on
      })
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
    const entry = byPeriod.get(periodOn) ?? null

    installments.push({
      period_on: periodOn,
      due_on: dueOn,
      status: getInstallmentStatus(dueOn, entry, today),
      entry
    })
  }

  return installments
}

/** Resumen para la tarjeta: atrasadas y próxima cuota sin cobrar */
export function summarizeInstallments(installments: readonly Installment[]) {
  const overdue = installments.filter((item) => item.status === "overdue")
  const next = installments.find((item) => item.status === "pending") ?? null

  return { overdueCount: overdue.length, next }
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
