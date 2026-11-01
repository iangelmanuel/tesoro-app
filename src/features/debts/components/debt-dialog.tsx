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
import { HelpHint } from "@/components/dashboard/help-hint"
import { createDebt, updateDebt } from "../actions"
import type { Debt } from "../queries"
import type { RateType } from "../schemas"
import type { DebtFormState } from "../types"
import { amountInput, rateInput } from "./field"

type PayableKind = "credit_card" | "loan"

interface DebtDialogProps {
  /** Si llega, el diálogo edita esta tarjeta o préstamo */
  debt?: Debt
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DebtDialog({
  debt,
  trigger,
  open: controlledOpen,
  onOpenChange
}: DebtDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const isEditing = debt !== undefined

  return (
    <Modal
      isOpen={open}
      onOpenChange={setOpen}
    >
      {trigger}
      <Modal.Backdrop>
        <Modal.Container scroll="outside">
          <Modal.Dialog className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {isEditing ? "Editar deuda" : "Nueva deuda"}
              </Modal.Heading>
              <p className="text-sm text-muted">
                {isEditing
                  ? "Cambia los datos de la deuda. Sus pagos y ajustes no cambian."
                  : "Una tarjeta de crédito o un préstamo que estás pagando."}
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              <DebtForm
                debt={debt}
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

interface DebtFormProps {
  debt?: Debt
  onSaved: () => void
  onCancel: () => void
}

function DebtForm({ debt, onSaved, onCancel }: DebtFormProps) {
  const isEditing = debt !== undefined

  const [state, formAction, pending] = useActionState<DebtFormState, FormData>(
    async (prevState, formData) => {
      const result = isEditing
        ? await updateDebt(prevState, formData)
        : await createDebt(prevState, formData)

      if (result.ok) {
        toast.success(isEditing ? "Deuda actualizada" : "Deuda creada")
        onSaved()
      }
      return result
    },
    {}
  )

  const errors = state.fieldErrors
  const values = state.values

  // El tipo solo se elige al crear
  const [kind, setKind] = useState<PayableKind>(
    debt?.kind === "loan" || values?.kind === "loan" ? "loan" : "credit_card"
  )
  const [rateType, setRateType] = useState<RateType>(
    (values?.rate_type as RateType | undefined) || debt?.rate_type || "ea"
  )
  const isCard = kind === "credit_card"

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
          value={debt.id}
        />
      ) : (
        <input
          type="hidden"
          name="kind"
          value={kind}
        />
      )}
      <input
        type="hidden"
        name="rate_type"
        value={rateType}
      />

      {!isEditing && (
        <div className="flex flex-col gap-2">
          <Label id="debt-kind-label">Tipo</Label>
          <ToggleButtonGroup
            aria-labelledby="debt-kind-label"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[kind]}
            onSelectionChange={(keys) => {
              const [value] = [...keys]
              if (value) setKind(value as PayableKind)
            }}
            fullWidth
          >
            <ToggleButton
              id="credit_card"
              className="flex-1"
            >
              Tarjeta de crédito
            </ToggleButton>
            <ToggleButton
              id="loan"
              className="flex-1"
            >
              Préstamo
            </ToggleButton>
          </ToggleButtonGroup>
          {errors?.kind && (
            <p className="text-sm text-danger">{errors.kind[0]}</p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="name"
          maxLength={60}
          defaultValue={values?.name ?? debt?.name}
          isRequired
          isInvalid={Boolean(errors?.name)}
          validationBehavior="aria"
          className="flex flex-col gap-2"
        >
          <Label>Nombre</Label>
          <Input placeholder={isCard ? "Visa" : "Crédito de vehículo"} />
          <FieldError>{errors?.name?.[0]}</FieldError>
        </TextField>

        <TextField
          name="counterparty"
          maxLength={60}
          defaultValue={values?.counterparty ?? debt?.counterparty ?? ""}
          isInvalid={Boolean(errors?.counterparty)}
          validationBehavior="aria"
          className="flex flex-col gap-2"
        >
          <Label>Entidad (opcional)</Label>
          <Input placeholder="Banco" />
          <FieldError>{errors?.counterparty?.[0]}</FieldError>
        </TextField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <AmountField
          id="opening_balance"
          label={isEditing ? "Saldo inicial" : "Saldo actual"}
          errors={errors?.opening_balance}
          defaultValue={
            values?.opening_balance ?? amountInput(debt?.opening_balance)
          }
          required
        />

        {isCard ? (
          <AmountField
            id="credit_limit"
            label="Cupo"
            errors={errors?.credit_limit}
            defaultValue={
              values?.credit_limit ?? amountInput(debt?.credit_limit)
            }
            required
          />
        ) : (
          <AmountField
            id="installment"
            label="Cuota mensual"
            errors={errors?.installment}
            defaultValue={values?.installment ?? amountInput(debt?.installment)}
            required
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <TextField
              name="interest_rate"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={
                values?.interest_rate ?? rateInput(debt?.interest_rate)
              }
              isRequired={!isCard}
              isInvalid={Boolean(errors?.interest_rate ?? errors?.rate_type)}
              validationBehavior="aria"
              className="flex flex-1 flex-col gap-2"
            >
              <Label>
                {isCard ? "Tasa de interés (opcional)" : "Tasa de interés"}
              </Label>
              <Input placeholder={isCard ? "28,5" : "0 si no tiene"} />
            </TextField>
            <ToggleButtonGroup
              aria-label="Tipo de tasa"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[rateType]}
              onSelectionChange={(keys) => {
                const [value] = [...keys]
                if (value) setRateType(value as RateType)
              }}
            >
              <ToggleButton id="ea">E.A.</ToggleButton>
              <ToggleButton id="mv">M.V.</ToggleButton>
            </ToggleButtonGroup>
          </div>
          {(errors?.interest_rate ?? errors?.rate_type) && (
            <p className="text-sm text-danger">
              {(errors?.interest_rate ?? errors?.rate_type)?.[0]}
            </p>
          )}
        </div>

        <DayField
          id="due_day"
          label="Día de pago"
          errors={errors?.due_day}
          defaultValue={values?.due_day ?? debt?.due_day ?? undefined}
          required
        />
      </div>

      {isCard ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <AmountField
              id="min_payment"
              label="Pago mínimo (opcional)"
              errors={errors?.min_payment}
              defaultValue={
                values?.min_payment ?? amountInput(debt?.min_payment)
              }
            />
            <DayField
              id="closing_day"
              label="Día de corte (opcional)"
              errors={errors?.closing_day}
              defaultValue={
                values?.closing_day ?? debt?.closing_day ?? undefined
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">
                Cuota de manejo (opcional)
              </span>
              <HelpHint topic="maintenanceFee" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <AmountField
                id="fee_amount"
                label="Monto mensual"
                errors={errors?.fee_amount}
                defaultValue={
                  values?.fee_amount ?? amountInput(debt?.fee_amount)
                }
              />
              <DayField
                id="fee_day"
                label="Día de cobro"
                errors={errors?.fee_day}
                defaultValue={values?.fee_day ?? debt?.fee_day ?? undefined}
              />
            </div>
            <p className="text-sm text-muted">
              Desde hoy se cobra sola. No la registres a mano.
            </p>
          </div>
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <AmountField
            id="original_amount"
            label="Monto original (opcional)"
            errors={errors?.original_amount}
            defaultValue={
              values?.original_amount ?? amountInput(debt?.original_amount)
            }
          />
          <TextField
            name="term_months"
            inputMode="numeric"
            defaultValue={
              values?.term_months ??
              (debt?.term_months != null ? String(debt.term_months) : undefined)
            }
            isInvalid={Boolean(errors?.term_months)}
            validationBehavior="aria"
            className="flex flex-col gap-2"
          >
            <Label>Plazo en meses (opcional)</Label>
            <Input
              type="number"
              min={1}
              max={600}
              placeholder="36"
            />
            <FieldError>{errors?.term_months?.[0]}</FieldError>
          </TextField>
        </div>
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
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Crear"}
        </Button>
      </div>
    </form>
  )
}

function AmountField({
  id,
  label,
  errors,
  defaultValue,
  required
}: {
  id: string
  label: string
  errors?: string[]
  defaultValue: string
  required?: boolean
}) {
  return (
    <TextField
      name={id}
      inputMode="decimal"
      autoComplete="off"
      defaultValue={defaultValue}
      isRequired={required}
      isInvalid={Boolean(errors)}
      validationBehavior="aria"
      className="flex flex-col gap-2"
    >
      <Label>{label}</Label>
      <Input placeholder="0" />
      <FieldError>{errors?.[0]}</FieldError>
    </TextField>
  )
}

function DayField({
  id,
  label,
  errors,
  defaultValue,
  required
}: {
  id: string
  label: string
  errors?: string[]
  defaultValue?: string | number
  required?: boolean
}) {
  return (
    <TextField
      name={id}
      inputMode="numeric"
      defaultValue={
        defaultValue === undefined ? undefined : String(defaultValue)
      }
      isRequired={required}
      isInvalid={Boolean(errors)}
      validationBehavior="aria"
      className="flex flex-col gap-2"
    >
      <Label>{label}</Label>
      <Input
        type="number"
        min={1}
        max={31}
        placeholder="15"
      />
      <FieldError>{errors?.[0]}</FieldError>
    </TextField>
  )
}
