"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
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
import { toast } from "@/components/ui/sonner"
import { SITE } from "@/config/site"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import {
  CategoriesSheet,
  preloadCategoriesSheet
} from "@/features/categories/components/categories-sheet"
import type { Category } from "@/features/categories/queries"
import {
  PaymentDialog,
  preloadPaymentForm
} from "@/features/debts/components/payment-dialog"
import { DEBTS_PATH, RECEIVABLES_PATH } from "@/features/debts/tabs"
import {
  ContributionDialog,
  preloadContributionForm
} from "@/features/goals/components/contribution-dialog"
import { GOALS_PATH } from "@/features/goals/progress"
import { IMPORT_PATH } from "@/features/imports/constants"
import {
  TransactionDialog,
  preloadTransactionForm
} from "@/features/transactions/components/transaction-dialog"
import type { PaymentTabsData } from "@/features/transactions/components/transaction-form-panels"
import {
  VerifyMovementsDialog,
  preloadVerifyMovements
} from "@/features/transactions/components/verify-movements-dialog"
import type { FormPanel } from "@/features/transactions/types"
import type { WorkspaceType } from "@/features/workspaces/types"
import { useOpenedOnce } from "@/hooks/use-opened-once"
import { useHideAmounts } from "../hide-amounts/hide-amounts-context"
import { loadFormData } from "./form-data"

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

/**
 * Lo que el layout entrega en cada ruta: los espacios con sus categorías y
 * cuentas. Metas, deudas, cobros, pagos pendientes e ingresos fijos de
 * Personal solo los usan los formularios: se piden al abrirlos o al pasar
 * por su disparador (`loadFormData`, SPEC 57)
 */
export interface QuickActionsData {
  workspaces: QuickActionsWorkspace[]
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
  /**
   * Precarga lo que abre una acción: el chunk del formulario y, en
   * Personal, sus datos. Va en `onPointerEnter` / `onFocus` del disparador
   */
  preload: (key: QuickActionKey) => void
  /** Precarga los datos de los formularios (al abrir la paleta o la hoja) */
  preloadFormData: () => void
}

const QuickActionsContext = createContext<QuickActionsValue | null>(null)

// Formulario diferido de cada acción (SPEC 56b)
const PRELOADS: Partial<Record<QuickActionKey, () => void>> = {
  movement: preloadTransactionForm,
  transfer: preloadTransactionForm,
  receivable: preloadTransactionForm,
  contribution: preloadContributionForm,
  payment: preloadPaymentForm,
  verify: preloadVerifyMovements,
  categories: preloadCategoriesSheet
}

// Acciones cuyo formulario usa los datos de Personal que se piden al abrir
const FORM_DATA_ACTIONS = new Set<QuickActionKey>([
  "movement",
  "transfer",
  "receivable",
  "contribution",
  "payment"
])

// Diálogos que abren las acciones; uno a la vez
type OpenDialog = Exclude<QuickActionKey, "import" | "theme" | "hide-amounts">

// Diálogo abierto. El de movimiento recibe los datos como promesa (abre en
// el acto con su skeleton); el resto, ya resueltos
interface DialogState {
  key: OpenDialog
  formData?: PaymentTabsData | Promise<PaymentTabsData | null>
}

const FORM_DATA_ERROR =
  "No se pudieron cargar tus metas y deudas. Intenta de nuevo."

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
// diálogos que abren las acciones. Cada uno se monta la primera vez que se
// abre y queda montado (`useOpenedOnce`, SPEC 57): al entrar no hidrata
// ninguno, y al cerrar conservan su estado como antes (la deuda elegida, la
// pestaña de Categorías)
export function QuickActionsProvider({
  value,
  children
}: Readonly<{ value: QuickActionsData; children: React.ReactNode }>) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams<{ id?: string }>()
  const { resolvedTheme, setTheme } = useTheme()
  const { hidden, toggle: toggleHidden } = useHideAmounts()
  const [dialog, setDialog] = useState<DialogState | null>(null)
  // Últimos datos resueltos: montan Aporte y Pago
  const [formData, setFormData] = useState<PaymentTabsData | null>(null)
  // Cerrar u otra acción descartan la respuesta de una apertura en curso
  const request = useRef(0)

  const workspace = pickWorkspace(value.workspaces, pathname, params.id)
  const isDark = resolvedTheme === "dark"
  const isPersonal = workspace?.type === "personal"

  const preloadFormData = useCallback(() => {
    if (isPersonal) void loadFormData(value)
  }, [isPersonal, value])

  const preload = useCallback(
    (key: QuickActionKey) => {
      PRELOADS[key]?.()
      if (FORM_DATA_ACTIONS.has(key)) preloadFormData()
    },
    [preloadFormData]
  )

  const run = useCallback(
    (key: QuickActionKey) => {
      const id = ++request.current
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
      }
      if (!isPersonal || !FORM_DATA_ACTIONS.has(key)) {
        setDialog({ key })
        return
      }

      const pending = loadFormData(value)
      // Movimiento y traspaso abren en el acto; el cuerpo espera los datos.
      // Si fallan, abre sin los tabs de pago y lo avisa. No guarda los datos
      // en el estado: Aporte y Pago los piden frescos al abrir, y guardarlos
      // aquí re-renderizaba el proveedor sin necesidad
      if (key === "movement" || key === "transfer") {
        setDialog({ key, formData: pending })
        void pending.then((data) => {
          if (!data && id === request.current) toast.error(FORM_DATA_ERROR)
        })
        return
      }

      // Sin metas, deudas o cobros, la acción lleva a su página a crear:
      // hay que tener los datos antes de abrir
      void pending.then((data) => {
        if (id !== request.current) return
        if (!data) {
          toast.error(FORM_DATA_ERROR)
          return
        }
        setFormData(data)
        if (key === "contribution" && data.goals.length === 0) {
          return router.push(GOALS_PATH)
        }
        if (key === "payment" && data.debts.length === 0) {
          return router.push(DEBTS_PATH)
        }
        if (key === "receivable" && data.receivables.length === 0) {
          return router.push(RECEIVABLES_PATH)
        }
        setDialog({ key: key as OpenDialog, formData: data })
      })
    },
    [router, setTheme, isDark, toggleHidden, isPersonal, value]
  )

  const context = useMemo<QuickActionsValue>(
    () => ({
      ...value,
      workspace,
      actions: buildActions(workspace, isDark, hidden),
      run,
      preload,
      preloadFormData
    }),
    [value, workspace, isDark, hidden, run, preload, preloadFormData]
  )

  function close(open: boolean) {
    if (!open) {
      request.current++
      setDialog(null)
    }
  }

  const openKey = dialog?.key
  const contributionOpened = useOpenedOnce(openKey === "contribution")
  const paymentOpened = useOpenedOnce(openKey === "payment")
  const categoriesOpened = useOpenedOnce(openKey === "categories")
  const verifyOpened = useOpenedOnce(openKey === "verify")
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
          {(openKey === "movement" ||
            openKey === "transfer" ||
            openKey === "receivable") && (
            <TransactionDialog
              key={`${workspace.id}-${openKey}`}
              workspaceId={workspace.id}
              workspaceType={workspace.type}
              categories={workspace.categories}
              accounts={workspace.accounts}
              // Personal: tabs "Deuda", "Me deben", "Gasto fijo" y "Meta", y
              // el select "Ingreso fijo" del tab Ingreso (SPEC 25, 30 y 39)
              paymentTabs={isPersonal ? dialog?.formData : undefined}
              initialPanel={movementPanel[openKey]}
              open
              onOpenChange={close}
            />
          )}
          {isPersonal && formData && contributionOpened && (
            <ContributionDialog
              key={`contribution-${workspace.id}`}
              workspaceId={workspace.id}
              goals={formData.goals}
              accounts={workspace.accounts}
              open={openKey === "contribution"}
              onOpenChange={close}
            />
          )}
          {isPersonal && formData && paymentOpened && (
            <PaymentDialog
              key={`payment-${workspace.id}`}
              workspaceId={workspace.id}
              debts={formData.debts}
              accounts={workspace.accounts}
              open={openKey === "payment"}
              onOpenChange={close}
            />
          )}
          {categoriesOpened && (
            <CategoriesSheet
              key={`categories-${workspace.id}`}
              workspaceId={workspace.id}
              categories={workspace.categories}
              open={openKey === "categories"}
              onOpenChange={close}
            />
          )}
          {verifyOpened && (
            <VerifyMovementsDialog
              key={`verify-${workspace.id}`}
              workspaceId={workspace.id}
              accounts={workspace.accounts}
              currency={workspace.currency}
              // Como en la página de Movimientos: solo Personal filtra por cuenta
              showAccountFilter={isPersonal}
              open={openKey === "verify"}
              onOpenChange={close}
            />
          )}
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
