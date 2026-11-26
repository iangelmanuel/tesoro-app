import "server-only"
import type { Workspace } from "@/features/workspaces/queries"
import { trimSeconds } from "@/libs/dates"
import { createClient } from "@/libs/supabase/server"
import { KIND_LABELS, type LoadedMovement } from "./export-calculations"
import type { ExportAccountRow } from "./types"

// Lecturas comunes de la exportación, con la sesión del usuario y RLS:
// nombres, movimientos y saldos por cuenta. Las consultas cubren el rango
// completo (no una por mes) y paginan de 1000 en 1000, el tope de filas por
// respuesta de Supabase.

const PAGE_SIZE = 1000

/** Cliente de Supabase de la exportación */
export type Supabase = Awaited<ReturnType<typeof createClient>>

interface PageResult<T> {
  data: T[] | null
  error: unknown
}

/** Todas las filas de una consulta, pidiéndolas por páginas de 1000 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  message: string
): Promise<T[]> {
  const rows: T[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error || !data) {
      throw new Error(message)
    }
    rows.push(...data)
    if (data.length < PAGE_SIZE) {
      return rows
    }
  }
}

/** Mes YYYY-MM del primer movimiento o traspaso del espacio, o null */
export async function getExportHistoryStart(workspaceId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("occurred_on")
    .eq("workspace_id", workspaceId)
    .in("kind", ["income", "expense", "transfer"])
    .order("occurred_on", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error("No se pudo leer el historial")
  }
  return data?.occurred_on ? data.occurred_on.slice(0, 7) : null
}

/** Nombres de categorías y cuentas por id */
export interface Names {
  categories: Map<string, string>
  accounts: Map<string, string>
}

/** Nombres de categorías (del sistema y propias) y cuentas del espacio */
export async function loadNames(supabase: Supabase, workspace: Workspace) {
  const [categories, accounts] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name")
      .eq("scope", workspace.type)
      .or(`workspace_id.is.null,workspace_id.eq.${workspace.id}`),
    supabase
      .from("accounts")
      .select("id, name")
      .eq("workspace_id", workspace.id)
  ])

  if (categories.error || accounts.error) {
    throw new Error("No se pudieron cargar las categorías y cuentas")
  }

  return {
    categories: new Map(categories.data.map((row) => [row.id, row.name])),
    accounts: new Map(accounts.data.map((row) => [row.id, row.name]))
  } satisfies Names
}

/**
 * Movimientos y traspasos del rango, en el orden de Movimientos dentro de
 * cada día (posición manual y captura), con las fechas de forma ascendente.
 * Ajustes, pagos de tarjeta y aportes a metas no son ingreso ni gasto y no
 * van en la exportación de movimientos.
 */
export async function loadMovements(
  supabase: Supabase,
  workspace: Workspace,
  bounds: { from: string; to: string },
  names: Names
): Promise<LoadedMovement[]> {
  const rows = await fetchAll(
    (from, to) =>
      supabase
        .from("ledger_entries")
        .select(
          "id, kind, amount, occurred_on, occurred_time, account_id, to_account_id, category_id, description, note, counterparty, invoice_ref"
        )
        .eq("workspace_id", workspace.id)
        .in("kind", ["income", "expense", "transfer"])
        .gte("occurred_on", bounds.from)
        .lte("occurred_on", bounds.to)
        .order("occurred_on", { ascending: true })
        .order("day_position", { ascending: true })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    "No se pudieron cargar los movimientos"
  )

  const labels = KIND_LABELS[workspace.type]
  const isBusiness = workspace.type === "business"

  return rows.map((row) => {
    const source = row.kind as LoadedMovement["source"]
    const date = row.occurred_on as string
    const accountId = row.account_id
    const isTransfer = source === "transfer"

    return {
      id: row.id as string,
      source,
      month: date.slice(0, 7),
      date,
      time: trimSeconds(row.occurred_time),
      kind: labels[source],
      description: isTransfer ? "Traspaso" : (row.description ?? ""),
      category: row.category_id
        ? (names.categories.get(row.category_id) ?? null)
        : null,
      account: accountId ? (names.accounts.get(accountId) ?? null) : null,
      destination:
        isTransfer && row.to_account_id
          ? (names.accounts.get(row.to_account_id) ?? null)
          : null,
      note: row.note,
      amount: Number(row.amount),
      ...(isBusiness
        ? { counterparty: row.counterparty, invoiceRef: row.invoice_ref }
        : {})
    }
  })
}

/** Saldos por cuenta de cada mes: mes YYYY-MM → filas */
export async function loadAccountBalances(
  supabase: Supabase,
  workspaceId: string,
  bounds: { from: string; to: string },
  names: Names
) {
  const { data, error } = await supabase.rpc("account_balances_by_month", {
    p_workspace_id: workspaceId,
    p_from: bounds.from,
    p_to: bounds.to
  })

  if (error) {
    throw new Error("No se pudieron calcular los saldos por cuenta")
  }

  const byMonth = new Map<string, ExportAccountRow[]>()
  for (const row of data) {
    const month = row.month.slice(0, 7)
    const list = byMonth.get(month) ?? []
    list.push({
      name: names.accounts.get(row.account_id) ?? "Cuenta",
      opening: Number(row.opening),
      inflow: Number(row.inflow),
      outflow: Number(row.outflow),
      closing: Number(row.closing)
    })
    byMonth.set(month, list)
  }
  return byMonth
}
