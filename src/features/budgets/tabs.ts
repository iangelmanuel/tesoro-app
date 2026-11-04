import { SITE } from "@/config/site"

export const BUDGETS_PATH = `${SITE.routes.dashboardPersonal}/budgets` as const

export const RECURRING_PATH = SITE.routes.personalRecurring

/** Pantallas del selector móvil, en orden: Gastos fijos va primero */
export const BUDGETS_TABS = ["recurring", "budgets"] as const

export type BudgetsTab = (typeof BUDGETS_TABS)[number]
