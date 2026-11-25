import type { Debt } from "@/features/debts/queries"
import {
  type EntryAllocation,
  INSTALLMENT_STATUS,
  type Installment,
  receivableInstallments
} from "@/features/debts/receivable-schedule"
import type { Workspace } from "@/features/workspaces/queries"
import { addDays, monthRange, todayISO } from "@/libs/dates"
import { roundCents } from "@/libs/money"
import type {
  BusinessMonthData,
  ExportAccountRow,
  ExportMovementKind,
  ExportMovementRow,
  ExportRange,
  PersonalMonthData
} from "./types"

// Cálculos puros de la exportación (SPEC 32): fechas del rango, sumas y las
// filas de cada hoja. Las lecturas están en los `*-export-queries.ts`.

/** Suma redondeada a centavos */
export const sumCents = (values: number[]) =>
  roundCents(values.reduce((a, b) => a + b, 0))

/** Fecha YYYY-MM-DD en America/Bogota de un timestamp */
export const dateOf = (timestamp: string) => todayISO(new Date(timestamp))

/**
 * Límites de fecha de la exportación: del primer día del primer mes al último
 * día del último, o a hoy si el último mes es el actual (el mes en curso se
 * exporta hasta hoy)
 */
export function exportBounds(range: ExportRange, today: string) {
  const last = monthRange(range.to).to
  return { from: monthRange(range.from).from, to: last < today ? last : today }
}

/** Primer y último día de un mes del rango, cortado en `bounds.to` */
export function monthBounds(month: string, bounds: { to: string }) {
  const { from, to } = monthRange(month)
  return { from, to: to < bounds.to ? to : bounds.to }
}

/** Filas agrupadas por su mes YYYY-MM, en el orden en que llegan */
export function groupByMonth<T extends { month: string }>(rows: T[]) {
  const byMonth = new Map<string, T[]>()
  for (const row of rows) {
    const list = byMonth.get(row.month) ?? []
    list.push(row)
    byMonth.set(row.month, list)
  }
  return byMonth
}

/** Tipo visible del movimiento según el espacio */
export const KIND_LABELS: Record<
  Workspace["type"],
  Record<"income" | "expense" | "transfer", ExportMovementKind>
> = {
  personal: { income: "Entrada", expense: "Salida", transfer: "Traspaso" },
  business: { income: "Entrada", expense: "Salida", transfer: "Traspaso" }
}

/** Movimiento leído, con los campos internos que no van al archivo */
export interface LoadedMovement extends ExportMovementRow {
  id: string
  source: "income" | "expense" | "transfer"
}

/** Quita los campos internos antes de entregar la fila */
export function toRow(movement: LoadedMovement): ExportMovementRow {
  const { counterparty, invoiceRef } = movement
  return {
    month: movement.month,
    date: movement.date,
    time: movement.time,
    kind: movement.kind,
    description: movement.description,
    category: movement.category,
    account: movement.account,
    destination: movement.destination,
    note: movement.note,
    amount: movement.amount,
    ...(counterparty !== undefined ? { counterparty, invoiceRef } : {})
  }
}

/** Saldo inicial y final del mes, sumando todas las cuentas */
export function summaryBalances(accounts: ExportAccountRow[]) {
  return {
    openingBalance: sumCents(accounts.map((row) => row.opening)),
    closingBalance: sumCents(accounts.map((row) => row.closing))
  }
}

/** Hoja de mes de Empresa: ventas, costos por categoría y traspasos */
export function businessMonth(
  month: string,
  rows: LoadedMovement[],
  accounts: ExportAccountRow[]
): BusinessMonthData {
  const sales = rows.filter((row) => row.source === "income")
  const costs = rows.filter((row) => row.source === "expense")

  const byCategory = new Map<string, number>()
  for (const row of costs) {
    const category = row.category ?? "Sin categoría"
    byCategory.set(category, (byCategory.get(category) ?? 0) + row.amount)
  }

  return {
    month,
    summary: {
      sales: sumCents(sales.map((row) => row.amount)),
      costs: sumCents(costs.map((row) => row.amount)),
      ...summaryBalances(accounts)
    },
    accounts,
    costsByCategory: [...byCategory]
      .map(([category, total]) => ({ category, total: roundCents(total) }))
      .sort((a, b) => b.total - a.total),
    sales: sales.map(toRow),
    costs: costs.map(toRow),
    transfers: rows.filter((row) => row.source === "transfer").map(toRow)
  }
}

/** Abono o cargo de una deuda, con lo que necesita la exportación */
export interface DebtEntryLite {
  id: string
  debt_id: string
  kind: string
  amount: number
  occurred_on: string
  /** Cuotas que cubre un abono de una mensual (SPEC 39) */
  allocations: EntryAllocation[]
}

/**
 * Saldo de una deuda a una fecha: mismo cálculo que debt_overview (saldo
 * inicial − abonos + ajustes, avances y cuotas de manejo)
 */
export function debtBalanceAt(
  debt: Debt,
  entries: DebtEntryLite[],
  on: string
) {
  return roundCents(
    entries
      .filter((entry) => entry.occurred_on <= on)
      .reduce(
        (balance, entry) =>
          entry.kind === "payment"
            ? balance - entry.amount
            : balance + entry.amount,
        debt.opening_balance
      )
  )
}

/** Tipo visible de una deuda (no cuenta por cobrar) */
export const DEBT_KIND_LABELS = {
  credit_card: "Tarjeta de crédito",
  loan: "Préstamo"
} as const

/** Cerrada (pagada o archivada) antes de empezar el mes */
export function debtClosedBefore(debt: Debt, from: string) {
  return (
    debt.status !== "active" &&
    debt.closed_at !== null &&
    dateOf(debt.closed_at) < from
  )
}

/** Estado de una cuenta por cobrar de pago único, igual que en Deudas */
export function receivableStatus(debt: Debt, today: string) {
  if (debt.status === "paid" || debt.balance <= 0) return "Cobrada"
  if (debt.status === "archived") return "Archivada"
  if (debt.expected_on !== null && debt.expected_on < today) return "Atrasada"
  return "Pendiente"
}

/** Mes YYYY-MM y días del mes en que cae la fila de Me deben */
export interface ReceivableMonth {
  month: string
  from: string
  to: string
  /** Abonos cobrados en el mes */
  collected: number
}

/**
 * Fila de Me deben de un mes, o null si la cuenta por cobrar no tiene nada
 * esperado, cobrado ni pendiente ese mes. `installment` es la cuota mensual
 * del mes calculada con todos los abonos (estado igual al de la página).
 */
export function receivableMonthRow(
  debt: Debt,
  all: DebtEntryLite[],
  installment: Installment | null,
  { month, from, to, collected }: ReceivableMonth,
  today: string
): PersonalMonthData["receivables"][number] | null {
  if (debt.schedule === "monthly") {
    // Pendiente al cierre con los abonos hechos hasta ese día
    let pendingAtClose: number
    if (debt.term_months === null) {
      const upToClose = receivableInstallments(
        debt,
        all.filter((entry) => entry.occurred_on <= to),
        today
      )
      pendingAtClose = sumCents(
        upToClose
          .filter((item) => item.period_on.slice(0, 7) <= month)
          .map((item) => item.remaining)
      )
    } else {
      pendingAtClose = Math.max(debtBalanceAt(debt, all, to), 0)
    }

    const expected = installment?.expected ?? 0
    if (expected === 0 && collected === 0 && pendingAtClose === 0) {
      return null
    }
    return {
      name: debt.name,
      expected,
      collected,
      pendingAtClose,
      status: installment
        ? INSTALLMENT_STATUS[installment.status].label
        : receivableStatus(debt, today)
    }
  }

  const pendingAtClose = Math.max(debtBalanceAt(debt, all, to), 0)
  const expectedThisMonth =
    debt.expected_on !== null &&
    debt.expected_on >= from &&
    debt.expected_on <= monthRange(month).to
  const expected = expectedThisMonth
    ? Math.max(debtBalanceAt(debt, all, addDays(from, -1)), 0)
    : 0

  if (expected === 0 && collected === 0 && pendingAtClose === 0) {
    return null
  }
  return {
    name: debt.name,
    expected,
    collected,
    pendingAtClose,
    status: receivableStatus(debt, today)
  }
}
