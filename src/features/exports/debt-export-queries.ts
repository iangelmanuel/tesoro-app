import "server-only"
import { getDebts } from "@/features/debts/queries"
import {
  type Installment,
  receivableInstallments
} from "@/features/debts/receivable-schedule"
import { addDays } from "@/libs/dates"
import {
  DEBT_KIND_LABELS,
  dateOf,
  debtBalanceAt,
  debtClosedBefore,
  monthBounds,
  receivableMonthRow,
  sumCents
} from "./export-calculations"
import { type Supabase, fetchAll } from "./movement-export-queries"
import type { ExportRange, PersonalMonthData } from "./types"

/**
 * Deudas y cuentas por cobrar de cada mes de Personal: abonos, cargos y
 * saldo al cierre (Deudas) y lo esperado, cobrado y pendiente (Me deben)
 */
export async function loadDebts(
  supabase: Supabase,
  workspaceId: string,
  range: ExportRange,
  bounds: { from: string; to: string },
  today: string
) {
  const [debts, entries] = await Promise.all([
    getDebts(workspaceId),
    fetchAll(
      (from, to) =>
        supabase
          .from("debt_entries")
          .select(
            "id, debt_id, kind, amount, occurred_on, allocations:debt_entry_allocations (period_on, amount)"
          )
          .eq("workspace_id", workspaceId)
          .order("id", { ascending: true })
          .range(from, to),
      "No se pudieron cargar los pagos de las deudas"
    )
  ])

  const entriesByDebt = Map.groupBy(
    entries.map((row) => ({
      ...row,
      amount: Number(row.amount),
      allocations: row.allocations.map((allocation) => ({
        period_on: allocation.period_on,
        amount: Number(allocation.amount)
      }))
    })),
    (row) => row.debt_id
  )

  // Las cuotas de una cuenta por cobrar mensual se calculan una vez con
  // todos sus abonos (estado igual al de la página)
  const installmentsByDebt = new Map<string, Map<string, Installment>>()
  for (const debt of debts) {
    if (debt.kind !== "receivable" || debt.schedule !== "monthly") continue
    const list = receivableInstallments(
      debt,
      entriesByDebt.get(debt.id) ?? [],
      today
    )
    installmentsByDebt.set(
      debt.id,
      new Map(list.map((item) => [item.period_on.slice(0, 7), item]))
    )
  }

  const debtsByMonth = new Map<string, PersonalMonthData["debts"]>()
  const receivablesByMonth = new Map<string, PersonalMonthData["receivables"]>()

  for (const month of range.months) {
    const { from, to } = monthBounds(month, bounds)
    const debtRows: PersonalMonthData["debts"] = []
    const receivableRows: PersonalMonthData["receivables"] = []

    for (const debt of debts) {
      if (dateOf(debt.created_at) > to) continue

      const all = entriesByDebt.get(debt.id) ?? []
      const inMonth = all.filter(
        (entry) => entry.occurred_on >= from && entry.occurred_on <= to
      )
      const payments = sumCents(
        inMonth
          .filter((entry) => entry.kind === "payment")
          .map((entry) => entry.amount)
      )
      const charges = sumCents(
        inMonth
          .filter((entry) => entry.kind !== "payment")
          .map((entry) => entry.amount)
      )

      if (debt.kind !== "receivable") {
        const opening = debtBalanceAt(debt, all, addDays(from, -1))
        const closing = debtBalanceAt(debt, all, to)
        // Sin actividad en el mes: sale si tiene saldo y no se cerró antes
        const idle = payments === 0 && charges === 0
        if (
          idle &&
          (debtClosedBefore(debt, from) || (opening === 0 && closing === 0))
        ) {
          continue
        }

        debtRows.push({
          name: debt.name,
          kind: DEBT_KIND_LABELS[debt.kind],
          payments,
          charges,
          balanceAtClose: closing
        })
        continue
      }

      const installment =
        debt.schedule === "monthly"
          ? (installmentsByDebt.get(debt.id)?.get(month) ?? null)
          : null
      const row = receivableMonthRow(
        debt,
        all,
        installment,
        { month, from, to, collected: payments },
        today
      )
      if (!row) continue
      if (debtClosedBefore(debt, from) && row.collected === 0) continue
      receivableRows.push(row)
    }

    debtsByMonth.set(month, debtRows)
    receivablesByMonth.set(month, receivableRows)
  }

  return { debtsByMonth, receivablesByMonth }
}
