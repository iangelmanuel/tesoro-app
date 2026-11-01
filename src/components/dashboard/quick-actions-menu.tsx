"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Dropdown, Label } from "@heroui/react"
import { ChevronDown, CreditCard, FileUp, Plus, Target } from "lucide-react"
import type { AccountOption } from "@/features/accounts/components/account-select"
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
import { useQuickActions } from "./quick-actions-context"
import { useActiveWorkspace } from "./use-active-workspace"

type MoreAction = "contribution" | "payment" | "import"

// En /dashboard/personal/* registra en Personal y en
// /dashboard/business/[id]/* en esa empresa. En otras rutas (cuenta, estado
// vacío de Empresa) no hay accesos
export function QuickActionsMenu() {
  const { goals, debts } = useQuickActions()
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
        trigger={
          <Button size="sm">
            <Plus className="size-4" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sr-only sm:hidden">{label}</span>
          </Button>
        }
      />
      {isPersonal && (
        <PersonalMoreMenu
          goals={goals}
          debts={debts}
          accounts={workspace.accounts}
        />
      )}
    </>
  )
}

function PersonalMoreMenu({
  goals,
  debts,
  accounts
}: {
  goals: GoalOption[]
  debts: DebtOption[]
  accounts: AccountOption[]
}) {
  const router = useRouter()
  const [contributionOpen, setContributionOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)

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
            <Dropdown.Item
              id="contribution"
              textValue="Aporte a meta"
            >
              <Target className="size-4" />
              <Label>Aporte a meta</Label>
            </Dropdown.Item>
            <Dropdown.Item
              id="payment"
              textValue="Pago de deuda"
            >
              <CreditCard className="size-4" />
              <Label>Pago de deuda</Label>
            </Dropdown.Item>
            <Dropdown.Item
              id="import"
              textValue="Importar"
            >
              <FileUp className="size-4" />
              <Label>Importar</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      {/* Controlados por el menú: no tienen trigger propio */}
      <ContributionDialog
        goals={goals}
        open={contributionOpen}
        onOpenChange={setContributionOpen}
      />
      <PaymentDialog
        debts={debts}
        accounts={accounts}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
      />
    </>
  )
}
