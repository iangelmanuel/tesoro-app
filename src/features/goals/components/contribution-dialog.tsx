"use client"

import { useActionState, useState } from "react"
import {
  Button,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  toast
} from "@heroui/react"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import {
  type PaymentAccountOption,
  PaymentAccountSection,
  parsePaymentAmount
} from "@/features/accounts/components/payment-account-section"
import { todayISO } from "@/libs/dates"
import { createContribution, updateContribution } from "../actions"
import type { GoalContribution } from "../queries"
import type { ContributionKind } from "../schemas"
import type { ContributionFormState } from "../types"

const AMOUNT_FORMAT = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2
})

const KIND_LABELS: Record<ContributionKind, string> = {
  deposit: "Aporte",
  withdrawal: "Retiro"
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
  /** Cuentas con saldo para el aporte; solo al registrar */
  accounts?: PaymentAccountOption[]
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ContributionDialog({
  workspaceId,
  goalId,
  goals,
  kind = "deposit",
  contribution,
  accounts = [],
  trigger,
  open: controlledOpen,
  onOpenChange
}: ContributionDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const isEditing = contribution !== undefined
  const initialKind: ContributionKind = contribution
    ? contribution.amount < 0
      ? "withdrawal"
      : "deposit"
    : kind

  return (
    <Modal
      isOpen={open}
      onOpenChange={setOpen}
    >
      {trigger}
      <Modal.Backdrop>
        <Modal.Container scroll="outside">
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {isEditing
                  ? `Editar ${KIND_LABELS[initialKind].toLowerCase()}`
                  : initialKind === "withdrawal"
                    ? "Retirar de la meta"
                    : "Aportar a la meta"}
              </Modal.Heading>
              <p className="text-sm text-muted">
                Un aporte no es un gasto. Con cuenta, solo mueve su saldo.
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              <ContributionForm
                workspaceId={workspaceId}
                goalId={goalId}
                goals={goals}
                initialKind={initialKind}
                contribution={contribution}
                accounts={accounts}
                onSaved={() => setOpen(false)}
                onCancel={() => setOpen(false)}
              />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

interface ContributionFormProps {
  workspaceId: string
  goalId?: string
  goals?: GoalOption[]
  initialKind: ContributionKind
  contribution?: EditableContribution
  accounts: PaymentAccountOption[]
  onSaved: () => void
  onCancel: () => void
}

function ContributionForm({
  workspaceId,
  goalId,
  goals,
  initialKind,
  contribution,
  accounts,
  onSaved,
  onCancel
}: ContributionFormProps) {
  const isEditing = contribution !== undefined
  const [kind, setKind] = useState<ContributionKind>(initialKind)
  // Sin meta fija arranca con la primera de la lista
  const [selectedGoalId, setSelectedGoalId] = useState(
    () => goalId ?? goals?.[0]?.id ?? ""
  )
  const showGoalSelect = !isEditing && !goalId && goals !== undefined
  const [occurredOn, setOccurredOn] = useState(
    () => contribution?.occurred_on ?? todayISO()
  )
  const [time, setTime] = useState(
    () => contribution?.occurred_time?.slice(0, 5) ?? ""
  )

  const [state, formAction, pending] = useActionState<
    ContributionFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isEditing
      ? await updateContribution(prevState, formData)
      : await createContribution(prevState, formData)

    if (result.ok) {
      toast.success(
        isEditing
          ? `${KIND_LABELS[kind]} actualizado`
          : `${KIND_LABELS[kind]} registrado`
      )
      onSaved()
    }
    return result
  }, {})

  const errors = state.fieldErrors
  const values = state.values
  const [amountText, setAmountText] = useState(
    () =>
      values?.amount ??
      (contribution ? AMOUNT_FORMAT.format(Math.abs(contribution.amount)) : "")
  )

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      {isEditing ? (
        <input
          type="hidden"
          name="id"
          value={contribution.id}
        />
      ) : (
        <input
          type="hidden"
          name="goal_id"
          value={selectedGoalId}
        />
      )}

      {showGoalSelect && (
        <Select
          fullWidth
          placeholder="Elige una meta"
          value={selectedGoalId || null}
          onChange={(key) => setSelectedGoalId(key == null ? "" : String(key))}
          isInvalid={Boolean(errors?.goal_id)}
          className="flex flex-col gap-2"
        >
          <Label>Meta</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {goals.map((goal) => (
                <ListBox.Item
                  key={goal.id}
                  id={goal.id}
                  textValue={goal.name}
                >
                  {goal.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
          <FieldError>{errors?.goal_id?.[0]}</FieldError>
        </Select>
      )}
      <input
        type="hidden"
        name="kind"
        value={kind}
      />

      <div className="flex flex-col gap-2">
        <Label id="contribution-kind-label">Tipo</Label>
        <ToggleButtonGroup
          aria-labelledby="contribution-kind-label"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[kind]}
          onSelectionChange={(keys) => {
            const [value] = [...keys]
            if (value) setKind(value as ContributionKind)
          }}
          fullWidth
        >
          <ToggleButton
            id="deposit"
            className="flex-1"
          >
            Aporte
          </ToggleButton>
          <ToggleButton
            id="withdrawal"
            className="flex-1"
          >
            Retiro
          </ToggleButton>
        </ToggleButtonGroup>
      </div>

      <TextField
        name="amount"
        inputMode="decimal"
        autoComplete="off"
        value={amountText}
        onChange={setAmountText}
        isRequired
        isInvalid={Boolean(errors?.amount)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Monto</Label>
        <Input placeholder="0" />
        <FieldError>{errors?.amount?.[0]}</FieldError>
      </TextField>

      <div className="grid gap-4 md:grid-cols-2">
        <DatePickerField
          name="occurred_on"
          label="Fecha"
          value={occurredOn}
          onChange={setOccurredOn}
          error={errors?.occurred_on?.[0]}
          maxValue={todayISO()}
          isRequired
        />

        <TimePickerField
          name="occurred_time"
          value={time}
          onChange={setTime}
          error={errors?.occurred_time?.[0]}
        />
      </div>

      <TextField
        name="note"
        maxLength={120}
        defaultValue={values?.note ?? contribution?.note ?? ""}
        isInvalid={Boolean(errors?.note)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Nota (opcional)</Label>
        <Input placeholder="Prima de diciembre" />
        <FieldError>{errors?.note?.[0]}</FieldError>
      </TextField>

      {/* La cuenta se elige al registrar; al editar solo cambian monto, fecha y
          nota. Un retiro entra a la cuenta y no lleva traspaso */}
      {!isEditing && accounts.length > 0 && (
        <PaymentAccountSection
          workspaceId={workspaceId}
          accounts={accounts}
          amount={parsePaymentAmount(amountText)}
          errors={{
            account_id: errors?.account_id?.[0],
            transfer_from: errors?.transfer_from?.[0],
            transfer_amount: errors?.transfer_amount?.[0]
          }}
          label={
            kind === "withdrawal" ? "Cuenta que recibe" : "Cuenta que paga"
          }
          direction={kind === "withdrawal" ? "in" : "out"}
        />
      )}

      {state.error && (
        <p
          role="alert"
          className="text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onPress={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          isDisabled={pending}
        >
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Registrar"}
        </Button>
      </div>
    </form>
  )
}

/**
 * Tab "Meta" del diálogo de movimiento (SPEC 30): elegir una meta activa y
 * registrar el aporte o retiro en el mismo formulario de ContributionDialog
 */
export function GoalContributionPanel({
  workspaceId,
  goals,
  accounts,
  onSaved,
  onCancel
}: {
  workspaceId: string
  /** Metas activas; al menos una */
  goals: GoalOption[]
  accounts: PaymentAccountOption[]
  onSaved: () => void
  onCancel: () => void
}) {
  return (
    <ContributionForm
      workspaceId={workspaceId}
      goals={goals}
      initialKind="deposit"
      accounts={accounts}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  )
}

// Solo deja elegir fechas hasta hoy
