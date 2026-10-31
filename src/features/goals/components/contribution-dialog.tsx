"use client"

import { useActionState, useState } from "react"
import {
  Button,
  FieldError,
  Input,
  Label,
  Modal,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  toast
} from "@heroui/react"
import { DatePickerField } from "@/components/forms/date-picker-field"
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

interface ContributionDialogProps {
  goalId: string
  /** Tipo inicial. Al editar se toma del signo del monto. */
  kind?: ContributionKind
  /** Si llega, el diálogo edita este aporte */
  contribution?: GoalContribution
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ContributionDialog({
  goalId,
  kind = "deposit",
  contribution,
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
    <Modal>
      {trigger}
      <Modal.Backdrop
        isOpen={open}
        onOpenChange={setOpen}
      >
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
                Los aportes no cambian tu balance ni tus movimientos.
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              <ContributionForm
                goalId={goalId}
                initialKind={initialKind}
                contribution={contribution}
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
  goalId: string
  initialKind: ContributionKind
  contribution?: GoalContribution
  onSaved: () => void
  onCancel: () => void
}

function ContributionForm({
  goalId,
  initialKind,
  contribution,
  onSaved,
  onCancel
}: ContributionFormProps) {
  const isEditing = contribution !== undefined
  const [kind, setKind] = useState<ContributionKind>(initialKind)
  const [occurredOn, setOccurredOn] = useState(
    () => contribution?.occurred_on ?? todayISO()
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
          value={goalId}
        />
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

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={
            values?.amount ??
            (contribution
              ? AMOUNT_FORMAT.format(Math.abs(contribution.amount))
              : "")
          }
          isRequired
          isInvalid={Boolean(errors?.amount)}
          validationBehavior="aria"
          className="flex flex-col gap-2"
        >
          <Label>Monto</Label>
          <Input placeholder="0" />
          <FieldError>{errors?.amount?.[0]}</FieldError>
        </TextField>

        <DatePickerField
          name="occurred_on"
          label="Fecha"
          value={occurredOn}
          onChange={setOccurredOn}
          error={errors?.occurred_on?.[0]}
          maxValue={todayISO()}
          isRequired
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

// Solo deja elegir fechas hasta hoy
