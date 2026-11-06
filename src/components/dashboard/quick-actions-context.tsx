"use client"

import { createContext, useContext } from "react"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import type { DebtOption } from "@/features/debts/components/payment-dialog"
import type { GoalOption } from "@/features/goals/components/contribution-dialog"
import type { UpcomingPayment } from "@/features/recurring-expenses/queries"
import type { IncomeSourceOption } from "@/features/recurring-incomes/queries"
import type { WorkspaceType } from "@/features/workspaces/queries"

/** Espacio donde los accesos rápidos pueden crear movimientos */
export interface QuickActionsWorkspace {
  id: string
  type: WorkspaceType
  /** Moneda del espacio (Verificar movimientos) */
  currency: string
  categories: Category[]
  accounts: PaymentAccountOption[]
}

export interface QuickActionsData {
  workspaces: QuickActionsWorkspace[]
  /** Metas activas de Personal */
  goals: GoalOption[]
  /** Deudas activas de Personal (sin cuentas por cobrar) */
  debts: DebtOption[]
  /** Ocurrencias de gastos fijos de Personal sin pagar (vencidas y pendientes) */
  pendingPayments: UpcomingPayment[]
  /**
   * Ingresos fijos activos de Personal con su ocurrencia no recibida más
   * antigua (select "Ingreso fijo" del tab Ingreso)
   */
  incomeSources: IncomeSourceOption[]
}

const QuickActionsContext = createContext<QuickActionsData | null>(null)

// Una sola carga en el servidor que comparten el header, la hoja de acciones
// rápidas y la barra inferior
export function QuickActionsProvider({
  value,
  children
}: Readonly<{ value: QuickActionsData; children: React.ReactNode }>) {
  return (
    <QuickActionsContext.Provider value={value}>
      {children}
    </QuickActionsContext.Provider>
  )
}

export function useQuickActions() {
  const context = useContext(QuickActionsContext)

  if (!context) {
    throw new Error(
      "useQuickActions debe usarse dentro de <QuickActionsProvider />"
    )
  }

  return context
}
