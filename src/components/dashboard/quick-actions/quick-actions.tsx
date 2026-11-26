import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getAccountBalances } from "@/features/accounts/queries"
import { getCategories } from "@/features/categories/queries"
import { isActiveDebt } from "@/features/debts/calculations"
import { debtPaymentDescriptions } from "@/features/debts/payment-description"
import { getDebtEntriesByDebt, getDebts } from "@/features/debts/queries"
import { toCollectableReceivable } from "@/features/debts/receivable-collect"
import { getExportHistoryStart } from "@/features/exports/movement-export-queries"
import { getGoals } from "@/features/goals/queries"
import { getUpcomingPayments } from "@/features/recurring-expenses/queries"
import { getIncomeSources } from "@/features/recurring-incomes/queries"
import {
  getBusinessWorkspaces,
  getPersonalWorkspace
} from "@/features/workspaces/queries"
import { todayISO } from "@/libs/dates"
import { CommandPaletteProvider } from "../command/command-palette-context"
import { CommandPaletteLazy } from "../command/command-palette-lazy"
import { CommandTrigger } from "../command/command-trigger"
import { MobileShell } from "../mobile/mobile-shell"
import { KeyboardShortcuts } from "../shortcuts/keyboard-shortcuts"
import {
  type QuickActionsData,
  QuickActionsProvider,
  type QuickActionsWorkspace
} from "./quick-actions-context"
import { QuickActionsMenu } from "./quick-actions-menu"

// Lee la sesión: va dentro de un Suspense por cacheComponents. El layout no
// conoce la ruta en el servidor, así que carga Personal (con sus metas,
// deudas e ingresos fijos activos) y las empresas que aceptan escrituras; el componente
// client elige el espacio activo por la ruta.
async function QuickActionsLoader() {
  const [personal, businesses] = await Promise.all([
    getPersonalWorkspace(),
    getBusinessWorkspaces()
  ])
  const targets = [
    {
      id: personal.id,
      type: "personal" as const,
      currency: personal.currency
    },
    ...businesses
      .filter((business) => business.deletionRequestedAt === null)
      .map((business) => ({
        id: business.id,
        type: business.type,
        currency: business.currency
      }))
  ]

  const [workspaces, goals, debts, payments, incomeSources] = await Promise.all(
    [
      Promise.all(
        targets.map(async (workspace): Promise<QuickActionsWorkspace> => {
          const [categories, accounts, historyStart] = await Promise.all([
            getCategories(workspace.id),
            getAccountBalances(workspace.id),
            getExportHistoryStart(workspace.id)
          ])
          return { ...workspace, categories, accounts, historyStart }
        })
      ),
      getGoals(personal.id),
      getDebts(personal.id),
      getUpcomingPayments(personal.id),
      getIncomeSources(personal.id)
    ]
  )

  // Cuentas por cobrar activas con sus abonos: las mensuales calculan sus
  // cuotas con ellos (tab "Me deben"). Tras leer la sesión: todayISO usa
  // new Date()
  const today = todayISO()
  const activeReceivables = debts.filter(
    (debt) => debt.kind === "receivable" && debt.status === "active"
  )
  const receivableEntries = await getDebtEntriesByDebt(
    activeReceivables
      .filter((debt) => debt.entries_count > 0)
      .map((debt) => debt.id)
  )
  const receivables = activeReceivables.map((debt) =>
    toCollectableReceivable(debt, receivableEntries.get(debt.id) ?? [], today)
  )

  const data: QuickActionsData = {
    workspaces,
    goals: goals
      .filter((goal) => goal.status === "active")
      .map(({ id, name }) => ({ id, name })),
    debts: debts.filter(isActiveDebt).map((debt) => ({
      id: debt.id,
      kind: debt.kind,
      name: debt.name,
      account_id: debt.account_id,
      descriptions: debtPaymentDescriptions(debt, today)
    })),
    receivables,
    // Ocurrencias sin pagar: las vencidas quedan primero (orden de vencimiento)
    pendingPayments: payments.filter(
      (payment) => payment.transactionId === null
    ),
    incomeSources
  }

  return (
    <QuickActionsProvider value={data}>
      <CommandPaletteProvider>
        <CommandTrigger />
        <QuickActionsMenu />
        <MobileShell />
        <CommandPaletteLazy />
        <KeyboardShortcuts />
      </CommandPaletteProvider>
    </QuickActionsProvider>
  )
}

/** Accesos rápidos del header: la paleta de comandos, el primario del
 *  espacio y el menú "Más" */
export function QuickActions() {
  return (
    // La ruta no se conoce en el shell estático: el placeholder tiene el
    // tamaño del botón primario para que el header no salte al cargar
    <Suspense fallback={<QuickActionsSkeleton />}>
      <QuickActionsLoader />
    </Suspense>
  )
}

/** Hueco de los accesos: el primario y "Más", con su alto y su forma */
export function QuickActionsSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-2"
    >
      <Skeleton className="hidden h-11 w-56 rounded-4xl md:block lg:w-72" />
      <Skeleton className="h-11 w-11 rounded-4xl sm:w-52" />
      <Skeleton className="h-11 w-11 rounded-4xl sm:w-20" />
    </div>
  )
}
