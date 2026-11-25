import type { Route } from "next"
import { SITE } from "@/config/site"

/** Página de Deudas */
export const DEBTS_PATH = `${SITE.routes.dashboardPersonal}/debts` as const

/** Tab Me deben de Deudas */
export const RECEIVABLES_PATH = `${DEBTS_PATH}?tab=receivables` as Route

export const DEBTS_TABS = ["debts", "receivables"] as const

export type DebtsTab = (typeof DEBTS_TABS)[number]

/** `?tab` de /dashboard/personal/debts; un valor inválido cae a debts */
export function parseDebtsTab(value: string | string[] | undefined) {
  return DEBTS_TABS.find((tab) => tab === value) ?? "debts"
}
