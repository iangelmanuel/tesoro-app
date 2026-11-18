"use client"

import { useActionState, useState } from "react"
import {
  Button,
  FieldError,
  Input,
  Label,
  Modal,
  Tabs,
  TextField,
  toast
} from "@heroui/react"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { todayISO } from "@/libs/dates"
import { formatCurrency } from "@/libs/format"
import { adjustBalance, updateEntry } from "../actions"
import type { Debt, DebtEntry } from "../queries"
import type { AdjustBalanceFormState } from "../types"
import { ConvertAdjustmentForm } from "./convert-adjustment-form"
import { amountInput } from "./field"

/**
 * Lo que necesita "Fue un pago" (SPEC 42). Sin él, el diálogo solo edita el
 * ajuste
 */
export interface ConvertAdjustmentOptions {
  debt: Pick<Debt, "kind" | "name">
  workspaceId: string
  accounts: PaymentAccountOption[]
  categories: Category[]
}

/** Editar el ajuste o convertirlo en pago */
type AdjustMode = "adjust" | "convert"

interface AdjustBalanceDialogProps {
  debt: Pick<Debt, "id" | "balance">
  /** Si llega, el diálogo edita este ajuste */
  entry?: DebtEntry
  currency: string
  /**
   * Convertir en pago (SPEC 42): con él, editar un ajuste que bajó el saldo
   * muestra el selector Ajuste | Fue un pago
   */
  convert?: ConvertAdjustmentOptions
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * "Actualizar saldo": el usuario escribe el saldo real (por ejemplo, el del
 * extracto) y se guarda un ajuste por la diferencia
 */
export function AdjustBalanceDialog({
  debt,
  entry,
  currency,
  convert,
  trigger,
  open: controlledOpen,
  onOpenChange
}: AdjustBalanceDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpenState = onOpenChange ?? setUncontrolledOpen
  const isEditing = entry !== undefined
  // Cada apertura arranca en "Ajuste"
  function setOpen(next: boolean) {
    if (!next) setMode("adjust")
    setOpenState(next)
  }
  // Solo un ajuste que bajó el saldo pudo ser un pago
  const canConvert = isEditing && entry.amount < 0 && convert !== undefined
  const [mode, setMode] = useState<AdjustMode>("adjust")
  const isConverting = canConvert && mode === "convert"
  const isReceivable = convert?.debt.kind === "receivable"

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
                {isEditing ? "Editar ajuste" : "Actualizar saldo"}
              </Modal.Heading>
              <p className="text-sm text-muted">
                {isConverting
                  ? isReceivable
                    ? "Si este ajuste fue un cobro, registra la cuenta a la que entró el dinero."
                    : "Si este ajuste fue un pago, registra la cuenta de la que salió el dinero."
                  : `Saldo actual: ${formatCurrency(debt.balance, currency)}. Escribe el saldo real, por ejemplo el de tu extracto. No crea un movimiento.`}
              </p>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              {canConvert && (
                <Tabs
                  selectedKey={mode}
                  onSelectionChange={(key) => setMode(key as AdjustMode)}
                >
                  <Tabs.ListContainer>
                    <Tabs.List aria-label="Qué fue este ajuste">
                      <Tabs.Tab id="adjust">
                        Ajuste
                        <Tabs.Indicator />
                      </Tabs.Tab>
                      <Tabs.Tab id="convert">
                        {isReceivable ? "Fue un cobro" : "Fue un pago"}
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    </Tabs.List>
                  </Tabs.ListContainer>
                </Tabs>
              )}
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              {isConverting ? (
                <ConvertAdjustmentForm
                  debt={convert.debt}
                  entry={entry}
                  workspaceId={convert.workspaceId}
                  accounts={convert.accounts}
                  categories={convert.categories}
                  currency={currency}
                  onSaved={() => setOpen(false)}
                  onCancel={() => setOpen(false)}
                />
              ) : (
                <AdjustBalanceForm
                  debt={debt}
                  entry={entry}
                  onSaved={() => setOpen(false)}
                  onCancel={() => setOpen(false)}
                />
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

interface AdjustBalanceFormProps {
  debt: Pick<Debt, "id" | "balance">
  entry?: DebtEntry
  onSaved: () => void
  onCancel: () => void
}

function AdjustBalanceForm({
  debt,
  entry,
  onSaved,
  onCancel
}: AdjustBalanceFormProps) {
  const isEditing = entry !== undefined
  const [occurredOn, setOccurredOn] = useState(
    () => entry?.occurred_on ?? todayISO()
  )
  const [time, setTime] = useState(
    () => entry?.occurred_time?.slice(0, 5) ?? ""
  )

  const [state, formAction, pending] = useActionState<
    AdjustBalanceFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isEditing
      ? await updateEntry(prevState, formData)
      : await adjustBalance(prevState, formData)

    if (result.ok) {
      toast.success(isEditing ? "Ajuste actualizado" : "Saldo actualizado")
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
          value={entry.id}
        />
      ) : (
        <input
          type="hidden"
          name="debt_id"
          value={debt.id}
        />
      )}

      <TextField
        name="balance"
        inputMode="decimal"
        autoComplete="off"
        defaultValue={
          values?.balance ?? (isEditing ? amountInput(debt.balance) : "")
        }
        isRequired
        isInvalid={Boolean(errors?.balance)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Saldo real</Label>
        <Input placeholder="0" />
        <FieldError>{errors?.balance?.[0]}</FieldError>
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
        defaultValue={values?.note ?? entry?.note ?? ""}
        isInvalid={Boolean(errors?.note)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Nota (opcional)</Label>
        <Input placeholder="Extracto de octubre" />
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
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Actualizar"}
        </Button>
      </div>
    </form>
  )
}
