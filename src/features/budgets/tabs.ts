import { SITE } from "@/config/site"

export const BUDGETS_PATH = `${SITE.routes.dashboardPersonal}/budgets` as const

export const BUDGETS_TABS = ["budgets", "recurring"] as const

export type BudgetsTab = (typeof BUDGETS_TABS)[number]

/** `?tab` de /dashboard/personal/budgets; un valor inválido cae a budgets */
export function parseBudgetsTab(value: string | string[] | undefined) {
  return BUDGETS_TABS.find((tab) => tab === value) ?? "budgets"
}
