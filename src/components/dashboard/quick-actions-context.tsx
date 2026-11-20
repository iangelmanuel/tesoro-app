"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState
} from "react"
import { useParams, usePathname, useRouter } from "next/navigation"
import {
  ArrowLeftRight,
  CreditCard,
  EyeOff,
  FileUp,
  HandCoins,
  ListChecks,
  type LucideIcon,
  Moon,
  Plus,
  Tags,
  Target
} from "lucide-react"
import { useTheme } from "next-themes"
import { SITE } from "@/config/site"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { CategoriesSheet } from "@/features/categories/components/categories-sheet"
import type { Category } from "@/features/categories/queries"
import { DEBTS_PATH, RECEIVABLES_PATH } from "@/features/debts/calculations"
import {
  type DebtOption,
  PaymentDialog
} from "@/features/debts/components/payment-dialog"
import type { CollectableReceivable } from "@/features/debts/receivable-collect"
import {
  ContributionDialog,
  type GoalOption
} from "@/features/goals/components/contribution-dialog"
import { GOALS_PATH } from "@/features/goals/progress"
import { IMPORT_PATH } from "@/features/imports/constants"
import type { UpcomingPayment } from "@/features/recurring-expenses/queries"
import type { IncomeSourceOption } from "@/features/recurring-incomes/queries"
import {
  type FormPanel,
  TransactionDialog
} from "@/features/transactions/components/transaction-dialog"
import { VerifyMovementsDialog } from "@/features/transactions/components/verify-movements-dialog"
import type { WorkspaceType } from "@/features/workspaces/queries"
import { useHideAmounts } from "./hide-amounts-context"

/** Espacio donde los accesos rápidos pueden crear movimientos */
export interface QuickActionsWorkspace {
  id: string
  type: WorkspaceType
  /** Moneda del espacio (Verificar movimientos) */
  currency: string
  categories: Category[]
  accounts: PaymentAccountOption[]
  /** Mes YYYY-MM del primer movimiento o traspaso (Exportar, SPEC 32) */
  historyStart: string | null
}

export interface QuickActionsData {
  workspaces: QuickActionsWorkspace[]
  /** Metas activas de Personal */
  goals: GoalOption[]
  /** Deudas activas de Personal (sin cuentas por cobrar) */
  debts: DebtOption[]
  /** Cuentas por cobrar activas de Personal (tab "Me deben", SPEC 39) */
  receivables: CollectableReceivable[]
  /** Ocurrencias de gastos fijos de Personal sin pagar (vencidas y pendientes) */
  pendingPayments: UpcomingPayment[]
  /**
   * Ingresos fijos activos de Personal con su ocurrencia no recibida más
   * antigua (select "Ingreso fijo" del tab Ingreso)
   */
  incomeSources: IncomeSourceOption[]
}

export type QuickActionKey =
  | "movement"
  | "transfer"
  | "contribution"
  | "payment"
  | "receivable"
  | "import"
  | "categories"
  | "verify"
  | "theme"
  | "hide-amounts"

/**
 * Una acción rápida. Esta lista es la única fuente que leen el botón del
 * header, la hoja móvil y el grupo Acciones de la paleta de comandos
 * (SPEC 51 §5)
 */
export interface QuickAction {
  key: QuickActionKey
  label: string
  icon: LucideIcon
  /** "register" registra datos; "tool" son herramientas y preferencias */
  group: "register" | "tool"
  /** Palabras extra para la búsqueda de la paleta */
  keywords?: string[]
}

interface QuickActionsValue extends QuickActionsData {
  /** Espacio de la ruta actual; undefined fuera de un espacio */
  workspace: QuickActionsWorkspace | undefined
  /** Acciones del espacio activo, en orden (vacía fuera de un espacio) */
  actions: QuickAction[]
  /** Ejecuta una acción: abre su diálogo, navega o cambia la preferencia */
  run: (key: QuickActionKey) => void
}

const QuickActionsContext = createContext<QuickActionsValue | null>(null)

// Diálogos que abren las acciones; uno a la vez
type OpenDialog = Exclude<QuickActionKey, "import" | "theme" | "hide-amounts">

// En /dashboard/personal/* es Personal y en /dashboard/business/[id]/* esa
// empresa. En otras rutas (cuenta, estado vacío de Empresa) no hay espacio
function pickWorkspace(
  workspaces: QuickActionsWorkspace[],
  pathname: string,
  businessId: string | undefined
) {
  const personal = SITE.routes.dashboardPersonal
  if (pathname === personal || pathname.startsWith(`${personal}/`)) {
    return workspaces.find((option) => option.type === "personal")
  }
  if (pathname.startsWith(`${SITE.routes.dashboardBusiness}/`)) {
    return workspaces.find(
      (option) => option.type === "business" && option.id === businessId
    )
  }
  return undefined
}

function buildActions(
  workspace: QuickActionsWorkspace | undefined,
  isDark: boolean,
  hidden: boolean
): QuickAction[] {
  if (!workspace) {
    return []
  }
  const isPersonal = workspace.type === "personal"
  const actions: (QuickAction | false)[] = [
    {
      key: "movement",
      label: "Nuevo movimiento",
      icon: Plus,
      group: "register",
      keywords: ["registrar", "gasto", "ingreso", "venta"]
    },
    {
      key: "transfer",
      label: "Traspaso",
      icon: ArrowLeftRight,
      group: "register",
      keywords: ["mover", "entre cuentas"]
    },
    isPersonal && {
      key: "payment",
      label: "Pagar deuda",
      icon: CreditCard,
      group: "register",
      keywords: ["tarjeta", "préstamo", "abono"]
    },
    isPersonal && {
      key: "contribution",
      label: "Aportar a meta",
      icon: Target,
      group: "register",
      keywords: ["ahorro"]
    },
    isPersonal && {
      key: "receivable",
      label: "Cobro de Me deben",
      icon: HandCoins,
      group: "register",
      keywords: ["cobrar", "préstamo"]
    },
    isPersonal && {
      key: "import",
      label: "Importar",
      icon: FileUp,
      group: "tool",
      keywords: ["excel", "csv", "extracto"]
    },
    { key: "categories", label: "Categorías", icon: Tags, group: "tool" },
    {
      key: "verify",
      label: "Verificar movimientos",
      icon: ListChecks,
      group: "tool",
      keywords: ["revisar", "conciliar"]
    },
    {
      key: "theme",
      label: isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro",
      icon: Moon,
      group: "tool",
      keywords: ["modo", "oscuro", "claro"]
    },
    {
      key: "hide-amounts",
      label: hidden ? "Mostrar cifras" : "Ocultar cifras",
      icon: EyeOff,
      group: "tool",
      keywords: ["montos", "privacidad"]
    }
  ]
  return actions.filter((action) => action !== false)
}

// Una sola carga en el servidor que comparten el header, la hoja de acciones
// rápidas, la barra inferior y la paleta. Además monta, una sola vez, los
// diálogos que abren las acciones
export function QuickActionsProvider({
  value,
  children
}: Readonly<{ value: QuickActionsData; children: React.ReactNode }>) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams<{ id?: string }>()
  const { resolvedTheme, setTheme } = useTheme()
  const { hidden, toggle: toggleHidden } = useHideAmounts()
  const [dialog, setDialog] = useState<OpenDialog | null>(null)

  const workspace = pickWorkspace(value.workspaces, pathname, params.id)
  const isDark = resolvedTheme === "dark"
  const { goals, debts, receivables, pendingPayments, incomeSources } = value

  const run = useCallback(
    (key: QuickActionKey) => {
      switch (key) {
        case "import":
          router.push(IMPORT_PATH)
          return
        case "theme":
          setTheme(isDark ? "light" : "dark")
          return
        case "hide-amounts":
          toggleHidden()
          return
        // Sin metas, deudas o cobros, la acción lleva a su página a crear
        case "contribution":
          if (goals.length === 0) return router.push(GOALS_PATH)
          break
        case "payment":
          if (debts.length === 0) return router.push(DEBTS_PATH)
          break
        case "receivable":
          if (receivables.length === 0) return router.push(RECEIVABLES_PATH)
          break
      }
      setDialog(key as OpenDialog)
    },
    [router, setTheme, isDark, toggleHidden, goals, debts, receivables]
  )

  const context = useMemo<QuickActionsValue>(
    () => ({
      ...value,
      workspace,
      actions: buildActions(workspace, isDark, hidden),
      run
    }),
    [value, workspace, isDark, hidden, run]
  )

  function close(open: boolean) {
    if (!open) setDialog(null)
  }

  const isPersonal = workspace?.type === "personal"
  const paymentTabs = isPersonal
    ? { debts, receivables, pendingPayments, goals, incomeSources }
    : undefined
  const movementPanel: Partial<Record<OpenDialog, FormPanel>> = {
    transfer: "transfer",
    receivable: "receivable"
  }

  return (
    <QuickActionsContext.Provider value={context}>
      {children}
      {/* Diálogos controlados por las acciones: no tienen trigger propio.
          Al cambiar de espacio (key) empiezan de cero */}
      {workspace && (
        <>
          {(dialog === "movement" ||
            dialog === "transfer" ||
            dialog === "receivable") && (
            <TransactionDialog
              key={`${workspace.id}-${dialog}`}
              workspaceId={workspace.id}
              workspaceType={workspace.type}
              categories={workspace.categories}
              accounts={workspace.accounts}
              // Personal: tabs "Deuda", "Me deben", "Gasto fijo" y "Meta", y
              // el select "Ingreso fijo" del tab Ingreso (SPEC 25, 30 y 39)
              paymentTabs={paymentTabs}
              initialPanel={movementPanel[dialog]}
              open
              onOpenChange={close}
            />
          )}
          {isPersonal && (
            <>
              <ContributionDialog
                key={`contribution-${workspace.id}`}
                workspaceId={workspace.id}
                goals={goals}
                accounts={workspace.accounts}
                open={dialog === "contribution"}
                onOpenChange={close}
              />
              <PaymentDialog
                key={`payment-${workspace.id}`}
                workspaceId={workspace.id}
                debts={debts}
                accounts={workspace.accounts}
                open={dialog === "payment"}
                onOpenChange={close}
              />
            </>
          )}
          <CategoriesSheet
            key={`categories-${workspace.id}`}
            workspaceId={workspace.id}
            categories={workspace.categories}
            open={dialog === "categories"}
            onOpenChange={close}
          />
          <VerifyMovementsDialog
            key={`verify-${workspace.id}`}
            workspaceId={workspace.id}
            accounts={workspace.accounts}
            currency={workspace.currency}
            // Como en la página de Movimientos: solo Personal filtra por cuenta
            showAccountFilter={isPersonal}
            open={dialog === "verify"}
            onOpenChange={close}
          />
        </>
      )}
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
