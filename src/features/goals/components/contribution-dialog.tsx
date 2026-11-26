"use client"

import { Suspense } from "react"
import {
  FormDialog,
  FormDialogBodySkeleton
} from "@/components/forms/form-dialog"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { lazyWithPreload } from "@/libs/lazy-with-preload"
import type { GoalContribution } from "../queries"
import type { ContributionKind } from "../schemas"
import { KIND_LABELS } from "./contribution-kind"

// Monto, fecha y cuenta se descargan al abrir el diálogo o al pasar por su
// disparador (SPEC 56b)
const ContributionForm = lazyWithPreload(() =>
  import("./contribution-form").then((m) => m.ContributionForm)
)

/** Precarga el formulario de aporte: `onPointerEnter` / `onFocus` */
export const preloadContributionForm = ContributionForm.preload

// El signo del monto guardado dice si es aporte o retiro
function kindOf(amount: number): ContributionKind {
  return amount < 0 ? "withdrawal" : "deposit"
}

function dialogTitle(isEditing: boolean, kind: ContributionKind) {
  if (isEditing) {
    return `Editar ${KIND_LABELS[kind].toLowerCase()}`
  }
  return kind === "withdrawal" ? "Retirar de la meta" : "Aportar a la meta"
}

/** Meta que se puede elegir en el diálogo (acceso rápido del header) */
export interface GoalOption {
  id: string
  name: string
}

/**
 * Campos de un aporte o retiro que el diálogo edita. Movimientos (SPEC 26)
 * los arma desde su fila sin cargar el aporte completo
 */
export type EditableContribution = Pick<
  GoalContribution,
  "id" | "amount" | "occurred_on" | "occurred_time" | "note"
>

/**
 * Prellenado de un aporte o retiro nuevo (Duplicar, SPEC 49). El monto va
 * sin signo: el tipo lo da `kind`. Sin fecha ni hora: ocurre hoy. Una cuenta
 * archivada llega como null
 */
export interface ContributionInitialValues {
  amount: number
  account_id: string | null
  note: string
}

interface ContributionDialogProps {
  /** Espacio de la meta (para crear una cuenta desde el select) */
  workspaceId: string
  /** Meta fija. Sin ella, el diálogo deja elegir entre `goals` */
  goalId?: string
  /** Metas activas para elegir; se usa cuando no llega `goalId` */
  goals?: GoalOption[]
  /** Tipo inicial. Al editar se toma del signo del monto. */
  kind?: ContributionKind
  /** Si llega, el diálogo edita este aporte */
  contribution?: EditableContribution
  /** Prellenado de un aporte nuevo; se ignora al editar */
  initialValues?: ContributionInitialValues
  /** Cuentas con saldo para el aporte; solo al registrar */
  accounts?: PaymentAccountOption[]
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ContributionDialog({
  workspaceId,
  goalId,
  goals,
  kind = "deposit",
  contribution,
  initialValues,
  accounts = [],
  trigger,
  open: controlledOpen,
  onOpenChange
}: ContributionDialogProps) {
  const isEditing = contribution !== undefined
  const initialKind = contribution ? kindOf(contribution.amount) : kind

  return (
    <FormDialog
      trigger={trigger}
      onTriggerIntent={ContributionForm.preload}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      className="sm:max-w-md"
      title={dialogTitle(isEditing, initialKind)}
      description="Un aporte no es una salida. Con cuenta, solo mueve su saldo."
    >
      {(close) => (
        <Suspense
          fallback={
            <FormDialogBodySkeleton
              fields={4}
              tabs
            />
          }
        >
          <ContributionForm.Component
            workspaceId={workspaceId}
            goalId={goalId}
            goals={goals}
            initialKind={initialKind}
            contribution={contribution}
            initialValues={isEditing ? undefined : initialValues}
            accounts={accounts}
            onSaved={close}
            onCancel={close}
          />
        </Suspense>
      )}
    </FormDialog>
  )
}
