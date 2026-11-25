"use client"

import type { ReactNode } from "react"
import type { Route } from "next"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { TransferForm } from "@/features/accounts/components/transfer-dialog"
import {
  type DebtOption,
  DebtPaymentPanel
} from "@/features/debts/components/payment-dialog"
import { ReceivableCollectForm } from "@/features/debts/components/receivable-collect-form"
import type { CollectableReceivable } from "@/features/debts/receivable-collect"
import { DEBTS_PATH, RECEIVABLES_PATH } from "@/features/debts/tabs"
import {
  GoalContributionPanel,
  type GoalOption
} from "@/features/goals/components/contribution-dialog"
import { GOALS_PATH } from "@/features/goals/progress"
import type { UpcomingPayment } from "@/features/recurring-expenses/queries"
import type { IncomeSourceOption } from "@/features/recurring-incomes/queries"
import type { FormPanel } from "../types"

/** Datos de los tabs de pago del diálogo (acceso rápido del header) */
export interface PaymentTabsData {
  /** Deudas activas: tarjetas y préstamos */
  debts: DebtOption[]
  /** Cuentas por cobrar activas (tab "Me deben", SPEC 39) */
  receivables: CollectableReceivable[]
  /** Ocurrencias de gastos fijos sin pagar, vencidas primero */
  pendingPayments: UpcomingPayment[]
  /** Metas activas (tab "Meta") */
  goals: GoalOption[]
  /** Ingresos fijos activos (select "Ingreso fijo" del tab Ingreso) */
  incomeSources: IncomeSourceOption[]
}

/** Props comunes de los paneles del selector de tipo */
export interface PanelProps {
  workspaceId: string
  accounts: PaymentAccountOption[]
  onSaved: () => void
  onCancel: () => void
}

/**
 * Panel de traspaso, deuda, me deben o meta según el selector de tipo; null
 * para el resto (entrada, salida o gasto fijo, que arma el formulario).
 * Traspaso no depende de los tabs de pago
 */
export function renderPaymentPanel(
  panel: FormPanel | null,
  paymentTabs: PaymentTabsData | undefined,
  props: PanelProps
): ReactNode {
  if (panel === "transfer") {
    return <TransferPanel {...props} />
  }
  if (!paymentTabs) {
    return null
  }

  switch (panel) {
    case "debt_payment":
      return (
        <DebtPanel
          debts={paymentTabs.debts}
          {...props}
        />
      )
    case "receivable":
      return (
        <ReceivablePanel
          receivables={paymentTabs.receivables}
          {...props}
        />
      )
    case "goal":
      return (
        <GoalPanel
          goals={paymentTabs.goals}
          {...props}
        />
      )
    default:
      return null
  }
}

/** Tab Traspaso: entre dos cuentas propias, no cuenta como entrada ni salida */
export function TransferPanel({
  workspaceId,
  accounts,
  onSaved,
  onCancel
}: PanelProps) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Mueve plata entre tus cuentas. No cuenta como entrada ni salida.
      </p>
      <TransferForm
        workspaceId={workspaceId}
        accounts={accounts}
        onSaved={onSaved}
        onCancel={onCancel}
      />
    </>
  )
}

/** Tab Deuda: pago o avance de una tarjeta o un préstamo */
export function DebtPanel({
  debts,
  ...props
}: PanelProps & { debts: DebtOption[] }) {
  return debts.length > 0 ? (
    <DebtPaymentPanel
      debts={debts}
      {...props}
    />
  ) : (
    <PanelEmpty
      text="No tienes tarjetas ni préstamos activos."
      href={DEBTS_PATH}
      action="Ir a Deudas"
      onNavigate={props.onCancel}
    />
  )
}

/** Tab Me deben: cobro de una cuenta por cobrar (SPEC 39) */
export function ReceivablePanel({
  receivables,
  ...props
}: PanelProps & { receivables: CollectableReceivable[] }) {
  return receivables.length > 0 ? (
    <ReceivableCollectForm
      receivables={receivables}
      {...props}
    />
  ) : (
    <PanelEmpty
      text="No tienes cuentas por cobrar activas."
      href={RECEIVABLES_PATH}
      action="Ir a Me deben"
      onNavigate={props.onCancel}
    />
  )
}

/** Tab Meta: aporte a una meta de ahorro */
export function GoalPanel({
  goals,
  ...props
}: PanelProps & { goals: GoalOption[] }) {
  return goals.length > 0 ? (
    <GoalContributionPanel
      goals={goals}
      {...props}
    />
  ) : (
    <PanelEmpty
      text="No tienes metas activas."
      href={GOALS_PATH}
      action="Ir a Metas"
      onNavigate={props.onCancel}
    />
  )
}

/** Tab de pago sin nada que pagar: lleva a la página donde se crean */
export function PanelEmpty({
  text,
  href,
  action,
  onNavigate
}: {
  text: string
  href: Route
  action: string
  /** Cierra el diálogo: el header no se desmonta al navegar */
  onNavigate: () => void
}) {
  return (
    <div className="flex flex-col items-start gap-3 py-2">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Link
        href={href}
        className={buttonVariants({ variant: "secondary" })}
        onClick={onNavigate}
      >
        {action}
      </Link>
    </div>
  )
}
