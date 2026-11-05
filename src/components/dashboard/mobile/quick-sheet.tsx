"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Drawer, Separator, Switch } from "@heroui/react"
import {
  CalendarCheck,
  CreditCard,
  ListChecks,
  Receipt,
  ShoppingBag,
  Tags,
  Target,
  TrendingDown,
  TrendingUp
} from "lucide-react"
import { RECURRING_PATH } from "@/features/budgets/tabs"
import { CategoriesSheet } from "@/features/categories/components/categories-sheet"
import { DEBTS_PATH } from "@/features/debts/calculations"
import { PaymentDialog } from "@/features/debts/components/payment-dialog"
import { ContributionDialog } from "@/features/goals/components/contribution-dialog"
import { GOALS_PATH } from "@/features/goals/progress"
import { PayOccurrenceDialog } from "@/features/recurring-expenses/components/pay-occurrence-dialog"
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"
import { VerifyMovementsDialog } from "@/features/transactions/components/verify-movements-dialog"
import type { TransactionType } from "@/features/transactions/filters"
import { useQuickActions } from "../quick-actions-context"
import { useActiveWorkspace } from "../use-active-workspace"

export type QuickSheetAction =
  | "expense"
  | "income"
  | "contribution"
  | "payment"
  | "recurring" // Personal
  | "sale"
  | "cost" // Empresa
  | "categories"
  | "verify" // Ambos

interface ActionItem {
  id: QuickSheetAction
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const PERSONAL_ACTIONS: ActionItem[] = [
  { id: "expense", label: "Gasto", icon: TrendingDown },
  { id: "income", label: "Ingreso", icon: TrendingUp },
  { id: "contribution", label: "Aporte a meta", icon: Target },
  { id: "payment", label: "Pago de deuda o tarjeta", icon: CreditCard },
  { id: "recurring", label: "Marcar gasto fijo pagado", icon: CalendarCheck }
]

const BUSINESS_ACTIONS: ActionItem[] = [
  { id: "sale", label: "Venta", icon: ShoppingBag },
  { id: "cost", label: "Costo o gasto", icon: Receipt }
]

// Herramientas del espacio (las mismas del menú Más): van aparte, bajo las
// acciones de registro
const TOOL_ACTIONS: ActionItem[] = [
  { id: "categories", label: "Categorías", icon: Tags },
  { id: "verify", label: "Verificar movimientos", icon: ListChecks }
]

// Tipo de movimiento que preselecciona cada acción de la hoja
const TRANSACTION_TYPES: Partial<Record<QuickSheetAction, TransactionType>> = {
  expense: "expense",
  income: "income",
  sale: "income",
  cost: "expense"
}

interface QuickSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Apertura automática al entrar (preferencia de este dispositivo) */
  autoOpen: boolean
  onAutoOpenChange: (autoOpen: boolean) => void
}

// Hoja inferior de acciones rápidas del teléfono. Cada acción cierra la hoja
// y abre su diálogo sin cambiar de página; sin metas, deudas o pendientes
// lleva a la página donde se crean. Se cierra deslizando el asa, tocando el
// fondo, con "Cerrar" o con Escape. Solo existe en rutas de un espacio.
export function QuickSheet({
  open,
  onOpenChange,
  autoOpen,
  onAutoOpenChange
}: QuickSheetProps) {
  const router = useRouter()
  const { goals, debts, pendingPayments } = useQuickActions()
  const workspace = useActiveWorkspace()
  const [dialog, setDialog] = useState<QuickSheetAction | null>(null)

  if (!workspace) {
    return null
  }

  const isPersonal = workspace.type === "personal"
  const actions = isPersonal ? PERSONAL_ACTIONS : BUSINESS_ACTIONS
  const transactionType = dialog ? TRANSACTION_TYPES[dialog] : undefined

  function onAction(action: QuickSheetAction) {
    onOpenChange(false)

    switch (action) {
      case "contribution":
        if (goals.length > 0) setDialog(action)
        else router.push(GOALS_PATH)
        break
      case "payment":
        if (debts.length > 0) setDialog(action)
        else router.push(DEBTS_PATH)
        break
      case "recurring":
        if (pendingPayments.length > 0) setDialog(action)
        else router.push(RECURRING_PATH)
        break
      default:
        setDialog(action)
    }
  }

  function closeDialog(isOpen: boolean) {
    if (!isOpen) setDialog(null)
  }

  function renderAction({ id, label, icon: Icon }: ActionItem) {
    return (
      <Button
        key={id}
        variant="secondary"
        fullWidth
        className="min-h-14 justify-start gap-3 text-base"
        onPress={() => onAction(id)}
      >
        <Icon className="size-5" />
        {label}
      </Button>
    )
  }

  return (
    <>
      <Drawer
        isOpen={open}
        onOpenChange={onOpenChange}
      >
        <Drawer.Backdrop className="md:hidden">
          <Drawer.Content placement="bottom">
            <Drawer.Dialog
              aria-label="Acciones rápidas"
              className="pb-[env(safe-area-inset-bottom)]"
            >
              <Drawer.Handle />
              <Drawer.Header>
                <Drawer.Heading>
                  {isPersonal ? "Registrar" : "Registrar operación"}
                </Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body className="flex flex-col gap-2">
                {actions.map(renderAction)}
                <Separator className="my-1" />
                {TOOL_ACTIONS.map(renderAction)}
              </Drawer.Body>
              <Drawer.Footer className="items-center justify-between gap-3">
                <Switch
                  isSelected={autoOpen}
                  onChange={onAutoOpenChange}
                  className="min-h-11"
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Switch.Content>Abrir al entrar</Switch.Content>
                </Switch>
                <Button
                  variant="ghost"
                  className="min-h-11 min-w-11"
                  onPress={() => onOpenChange(false)}
                >
                  Cerrar
                </Button>
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>

      {/* Controlados por la hoja: no tienen trigger propio */}
      {transactionType && (
        <TransactionDialog
          // Cada acción monta el formulario con su tipo preseleccionado
          key={`${workspace.id}-${dialog}`}
          workspaceId={workspace.id}
          workspaceType={workspace.type}
          categories={workspace.categories}
          accounts={workspace.accounts}
          initialValues={{ type: transactionType }}
          open
          onOpenChange={closeDialog}
        />
      )}
      <CategoriesSheet
        workspaceId={workspace.id}
        categories={workspace.categories}
        open={dialog === "categories"}
        onOpenChange={closeDialog}
      />
      <VerifyMovementsDialog
        workspaceId={workspace.id}
        accounts={workspace.accounts}
        currency={workspace.currency}
        showAccountFilter={isPersonal}
        open={dialog === "verify"}
        onOpenChange={closeDialog}
      />
      {isPersonal && (
        <>
          <ContributionDialog
            workspaceId={workspace.id}
            goals={goals}
            accounts={workspace.accounts}
            open={dialog === "contribution"}
            onOpenChange={closeDialog}
          />
          <PaymentDialog
            workspaceId={workspace.id}
            debts={debts}
            accounts={workspace.accounts}
            open={dialog === "payment"}
            onOpenChange={closeDialog}
          />
          <PayOccurrenceDialog
            workspaceId={workspace.id}
            payments={pendingPayments}
            categories={workspace.categories}
            accounts={workspace.accounts}
            open={dialog === "recurring"}
            onOpenChange={closeDialog}
          />
        </>
      )}
    </>
  )
}
