import type { LoadedDebt, LoadedEntry } from "@/features/debts/debt-loader"
import type { AppSupabase } from "@/libs/supabase/types"
import { debtEntryFixture } from "./fixtures"

// Apoyo de los tests de los servicios de deudas (SPEC 55b): deuda y
// movimiento ya cargados, y un cliente que falla si se consulta

/** Cliente que falla si se usa: los casos probados no deben consultar */
export const NO_DB = new Proxy(
  {},
  {
    get() {
      throw new Error("No debe consultar Supabase")
    }
  }
) as AppSupabase

export function loadedDebt(fields: Partial<LoadedDebt>): LoadedDebt {
  return {
    id: "debt",
    workspace_id: "workspace",
    kind: "loan",
    status: "active",
    name: "Deuda",
    opening_balance: 1_000_000,
    installment: null,
    schedule: null,
    starts_on: null,
    term_months: null,
    entries: [],
    balance: 1_000_000,
    openEnded: false,
    ...fields
  }
}

export function loadedEntry(
  fields: Partial<LoadedEntry>,
  debt: Partial<LoadedDebt> = {}
): LoadedEntry {
  const {
    account_name,
    payment_account_id,
    description,
    category_id,
    allocations,
    ...row
  } = debtEntryFixture({ amount: 200_000 })
  void account_name
  void payment_account_id
  void description
  void category_id
  void allocations
  return { ...row, debt: loadedDebt(debt), ...fields }
}
