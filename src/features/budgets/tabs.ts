import { SITE } from "@/config/site"

/** Presupuestos de Personal */
export const BUDGETS_PATH = `${SITE.routes.dashboardPersonal}/budgets` as const

/** Gastos fijos de Personal */
export const RECURRING_PATH = SITE.routes.personalRecurring

/** Pantallas del selector móvil, en orden: Gastos fijos va primero */
export const BUDGETS_TABS = ["recurring", "budgets"] as const

/** Pantalla del selector móvil */
export type BudgetsTab = (typeof BUDGETS_TABS)[number]
