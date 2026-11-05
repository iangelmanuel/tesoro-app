"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Dropdown, Label } from "@heroui/react"
import {
  ChevronDown,
  CreditCard,
  FileUp,
  ListChecks,
  Plus,
  Tags,
  Target
} from "lucide-react"
import { CategoriesSheet } from "@/features/categories/components/categories-sheet"
import { DEBTS_PATH } from "@/features/debts/calculations"
import {
  type DebtOption,
  PaymentDialog
} from "@/features/debts/components/payment-dialog"
import {
  ContributionDialog,
  type GoalOption
} from "@/features/goals/components/contribution-dialog"
import { GOALS_PATH } from "@/features/goals/progress"
import { IMPORT_PATH } from "@/features/imports/constants"
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"
import { VerifyMovementsDialog } from "@/features/transactions/components/verify-movements-dialog"
import {
  type QuickActionsWorkspace,
  useQuickActions
} from "./quick-actions-context"
import { useActiveWorkspace } from "./use-active-workspace"

type MoreAction =
  "contribution" | "payment" | "import" | "categories" | "verify"

// En /dashboard/personal/* registra en Personal y en
// /dashboard/business/[id]/* en esa empresa. En otras rutas (cuenta, estado
// vacío de Empresa) no hay accesos
export function QuickActionsMenu() {
  const { goals, debts, pendingPayments } = useQuickActions()
  const workspace = useActiveWorkspace()

  if (!workspace) {
    return null
  }

  const isPersonal = workspace.type === "personal"
  const label = isPersonal ? "Registrar movimiento" : "Registrar operación"

  return (
    <>
      <TransactionDialog
        // Al cambiar de espacio el diálogo empieza de cero
        key={workspace.id}
        workspaceId={workspace.id}
        workspaceType={workspace.type}
        categories={workspace.categories}
        accounts={workspace.accounts}
        // Personal: tabs "Pago de deuda" y "Gasto fijo" (SPEC 25)
        paymentTabs={isPersonal ? { debts, pendingPayments } : undefined}
        trigger={
          <Button
            size="sm"
            className="max-md:h-11 max-md:min-w-11"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sr-only sm:hidden">{label}</span>
          </Button>
        }
      />
      <MoreMenu
        // Los diálogos del menú también empiezan de cero al cambiar de espacio
        key={`more-${workspace.id}`}
        workspace={workspace}
        goals={goals}
        debts={debts}
      />
    </>
  )
}

// Personal: aporte, pago, importar, categorías y verificar. Empresa no tiene
// metas, deudas ni importación: solo categorías y verificar
function MoreMenu({
  workspace,
  goals,
  debts
}: {
  workspace: QuickActionsWorkspace
  goals: GoalOption[]
  debts: DebtOption[]
}) {
  const router = useRouter()
  const [contributionOpen, setContributionOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const { accounts } = workspace
  const isPersonal = workspace.type === "personal"

  // Sin metas (o sin deudas) el ítem lleva a su página para crear una
  function onAction(key: React.Key) {
    switch (key as MoreAction) {
      case "contribution":
        if (goals.length > 0) setContributionOpen(true)
        else router.push(GOALS_PATH)
        break
      case "payment":
        if (debts.length > 0) setPaymentOpen(true)
        else router.push(DEBTS_PATH)
        break
      case "import":
        router.push(IMPORT_PATH)
        break
      // Se abren sobre la página actual: no dependen de que haya movimientos
      case "categories":
        setCategoriesOpen(true)
        break
      case "verify":
        setVerifyOpen(true)
        break
    }
  }

  return (
    <>
      <Dropdown>
        {/* Button de HeroUI como trigger (igual que en las tarjetas de
            cuentas): Dropdown.Trigger no aplica el layout del botón */}
        <Button
          variant="secondary"
          size="sm"
          aria-label="Más acciones"
          className="max-md:h-11 max-md:min-w-11"
        >
          <span className="hidden sm:inline">Más</span>
          <ChevronDown className="size-4" />
        </Button>
        <Dropdown.Popover
          placement="bottom end"
          className="min-w-52"
        >
          <Dropdown.Menu
            aria-label="Más acciones"
            onAction={onAction}
          >
            {isPersonal && (
              <Dropdown.Item
                id="contribution"
                textValue="Aporte a meta"
              >
                <Target className="size-4" />
                <Label>Aporte a meta</Label>
              </Dropdown.Item>
            )}
            {isPersonal && (
              <Dropdown.Item
                id="payment"
                textValue="Pago de deuda"
              >
                <CreditCard className="size-4" />
                <Label>Pago de deuda</Label>
              </Dropdown.Item>
            )}
            {isPersonal && (
              <Dropdown.Item
                id="import"
                textValue="Importar"
              >
                <FileUp className="size-4" />
                <Label>Importar</Label>
              </Dropdown.Item>
            )}
            <Dropdown.Item
              id="categories"
              textValue="Categorías"
            >
              <Tags className="size-4" />
              <Label>Categorías</Label>
            </Dropdown.Item>
            <Dropdown.Item
              id="verify"
              textValue="Verificar movimientos"
            >
              <ListChecks className="size-4" />
              <Label>Verificar movimientos</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      {/* Controlados por el menú: no tienen trigger propio */}
      {isPersonal && (
        <>
          <ContributionDialog
            workspaceId={workspace.id}
            goals={goals}
            accounts={accounts}
            open={contributionOpen}
            onOpenChange={setContributionOpen}
          />
          <PaymentDialog
            workspaceId={workspace.id}
            debts={debts}
            accounts={accounts}
            open={paymentOpen}
            onOpenChange={setPaymentOpen}
          />
        </>
      )}
      <CategoriesSheet
        workspaceId={workspace.id}
        categories={workspace.categories}
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
      />
      <VerifyMovementsDialog
        workspaceId={workspace.id}
        accounts={accounts}
        currency={workspace.currency}
        // Como en la página de Movimientos: solo Personal filtra por cuenta
        showAccountFilter={isPersonal}
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
      />
    </>
  )
}
