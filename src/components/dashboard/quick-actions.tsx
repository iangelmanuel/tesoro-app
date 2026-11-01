import { Suspense } from "react"
import { Skeleton } from "@heroui/react"
import { getAccountBalances } from "@/features/accounts/queries"
import { getCategories } from "@/features/categories/queries"
import { isActiveDebt } from "@/features/debts/calculations"
import { getDebts } from "@/features/debts/queries"
import { getGoals } from "@/features/goals/queries"
import { getUpcomingPayments } from "@/features/recurring-expenses/queries"
import {
  getBusinessWorkspaces,
  getPersonalWorkspace
} from "@/features/workspaces/queries"
import {
  type QuickActionsData,
  QuickActionsProvider,
  type QuickActionsWorkspace
} from "./quick-actions-context"
import { QuickActionsMenu } from "./quick-actions-menu"

// Lee la sesión: va dentro de un Suspense por cacheComponents. El layout no
// conoce la ruta en el servidor, así que carga Personal (con sus metas y
// deudas activas) y las empresas que aceptan escrituras; el componente
// client elige el espacio activo por la ruta.
async function QuickActionsLoader() {
  const [personal, businesses] = await Promise.all([
    getPersonalWorkspace(),
    getBusinessWorkspaces()
  ])
  const targets = [
    { id: personal.id, type: "personal" as const },
    ...businesses
      .filter((business) => business.deletionRequestedAt === null)
      .map((business) => ({ id: business.id, type: business.type }))
  ]

  const [workspaces, goals, debts, payments] = await Promise.all([
    Promise.all(
      targets.map(async (workspace): Promise<QuickActionsWorkspace> => {
        const [categories, accounts] = await Promise.all([
          getCategories(workspace.id),
          getAccountBalances(workspace.id)
        ])
        return { ...workspace, categories, accounts }
      })
    ),
    getGoals(personal.id),
    getDebts(personal.id),
    getUpcomingPayments(personal.id)
  ])

  const data: QuickActionsData = {
    workspaces,
    goals: goals
      .filter((goal) => goal.status === "active")
      .map(({ id, name }) => ({ id, name })),
    debts: debts
      .filter(isActiveDebt)
      .map(({ id, kind, name }) => ({ id, kind, name })),
    // Ocurrencias sin pagar: las vencidas quedan primero (orden de vencimiento)
    pendingPayments: payments.filter(
      (payment) => payment.transactionId === null
    )
  }

  return (
    <QuickActionsProvider value={data}>
      <QuickActionsMenu />
    </QuickActionsProvider>
  )
}

/** Accesos rápidos del header: el primario del espacio y, en Personal, "Más" */
export function QuickActions() {
  return (
    // La ruta no se conoce en el shell estático: el placeholder tiene el
    // tamaño del botón primario para que el header no salte al cargar
    <Suspense fallback={<Skeleton className="h-9 w-40 rounded-3xl" />}>
      <QuickActionsLoader />
    </Suspense>
  )
}
