import type { RowChange } from "../../operations"
import type { McpContext } from "../../types"

// Antes y después de una escritura sobre una deuda (SPEC 43), para el log de
// operaciones. El orden de las filas importa: undo_mcp_operation restaura
// de la última a la primera, así que
//   1. los movimientos creados (se borran al final, ya sin abono que los use);
//   2. los movimientos editados;
//   3. el abono;
//   4. los movimientos borrados (se recrean antes que el abono que los usa);
//   5. las asignaciones de una mensual (undo las restaura al final, por abono);
//   6. la deuda (su estado al saldarse): se restaura primero, para que el
//      abono de una deuda saldada se pueda borrar.

type Row = { id: string; updated_at?: string } & Record<string, unknown>

export interface DebtSnapshot {
  debt: Row | null
  entry: Row | null
  transactions: Map<string, Row>
  allocations: Row[]
}

/** Estado actual de un abono, su deuda, sus movimientos y sus asignaciones */
export async function snapshotDebtEntry(
  ctx: McpContext,
  {
    debtId,
    entryId,
    transactionIds = []
  }: { debtId: string; entryId: string | null; transactionIds?: string[] }
): Promise<DebtSnapshot> {
  const [debt, entry, allocations] = await Promise.all([
    ctx.supabase.from("debts").select("*").eq("id", debtId).maybeSingle(),
    entryId
      ? ctx.supabase
          .from("debt_entries")
          .select("*")
          .eq("id", entryId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    entryId
      ? ctx.supabase
          .from("debt_entry_allocations")
          .select("*")
          .eq("entry_id", entryId)
          .order("period_on")
      : Promise.resolve({ data: [] })
  ])

  const ids = [
    ...new Set(
      [entry.data?.transaction_id ?? null, ...transactionIds].filter(
        (id): id is string => id !== null
      )
    )
  ]
  const { data: transactions } = ids.length
    ? await ctx.supabase.from("transactions").select("*").in("id", ids)
    : { data: [] }

  return {
    debt: debt.data,
    entry: entry.data,
    transactions: new Map((transactions ?? []).map((row) => [row.id, row])),
    allocations: allocations.data ?? []
  }
}

function changed(before: Row | null, after: Row | null) {
  if (!before || !after) {
    return before !== after
  }
  return JSON.stringify(before) !== JSON.stringify(after)
}

/** Las filas que cambiaron entre dos snapshots, en el orden del log */
export function debtChanges(
  before: DebtSnapshot,
  after: DebtSnapshot
): RowChange[] {
  const changes: RowChange[] = []

  const ids = new Set([
    ...before.transactions.keys(),
    ...after.transactions.keys()
  ])
  const created: RowChange[] = []
  const updated: RowChange[] = []
  const deleted: RowChange[] = []
  for (const id of ids) {
    const old = before.transactions.get(id) ?? null
    const now = after.transactions.get(id) ?? null
    if (!changed(old, now)) continue
    const change: RowChange = {
      table: "transactions",
      rowId: id,
      before: old,
      after: now
    }
    if (!old) created.push(change)
    else if (!now) deleted.push(change)
    else updated.push(change)
  }
  changes.push(...created, ...updated)

  const entry = before.entry ?? after.entry
  if (entry && changed(before.entry, after.entry)) {
    changes.push({
      table: "debt_entries",
      rowId: entry.id,
      before: before.entry,
      after: after.entry
    })
  }
  changes.push(...deleted)

  // Las asignaciones van completas: las de antes y las de después
  if (
    JSON.stringify(before.allocations) !== JSON.stringify(after.allocations)
  ) {
    for (const row of before.allocations) {
      changes.push({
        table: "debt_entry_allocations",
        rowId: row.id,
        before: row,
        after: null
      })
    }
    for (const row of after.allocations) {
      changes.push({
        table: "debt_entry_allocations",
        rowId: row.id,
        before: null,
        after: row
      })
    }
  }

  // Al final: undo la restaura primero. check_debt_entry no deja tocar los
  // abonos de una deuda que no está activa (p. ej. saldada por un cobro)
  if (before.debt && after.debt && changed(before.debt, after.debt)) {
    changes.push({
      table: "debts",
      rowId: before.debt.id,
      before: before.debt,
      after: after.debt
    })
  }

  return changes
}
