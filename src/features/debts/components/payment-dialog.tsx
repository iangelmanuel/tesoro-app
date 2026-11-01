"use client"

import { useActionState, useState } from "react"
import {
  Button,
  Checkbox,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
  toast
} from "@heroui/react"
import { DatePickerField } from "@/components/forms/date-picker-field"
import {
  type AccountOption,
  AccountSelect,
  selectableAccounts
} from "@/features/accounts/components/account-select"
import { todayISO } from "@/libs/dates"
import { recordPayment, updateEntry } from "../actions"
import type { Debt, DebtEntry } from "../queries"
import type { PaymentFormState } from "../types"
import { amountInput } from "./field"

type PaymentDebt = Pick<Debt, "id" | "kind">

/** Deuda que se puede elegir en el diálogo (acceso rápido del header) */
export type DebtOption = Pick<Debt, "id" | "kind" | "name">

interface PaymentDialogProps {
  /** Deuda fija. Sin ella, el diálogo deja elegir entre `debts` */
  debt?: PaymentDebt
  /** Deudas activas para elegir; se usa cuando no llega `debt` */
  debts?: DebtOption[]
  /** Si llega, el diálogo edita este pago */
  entry?: DebtEntry
  /** Cuentas para el movimiento que crea el pago; solo al registrar */
  accounts?: AccountOption[]
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/** Pago de tarjeta o préstamo, o abono de una cuenta por cobrar */
export function PaymentDialog({
  debt: fixedDebt,
  debts,
  entry,
  accounts = [],
  trigger,
  open: controlledOpen,
  onOpenChange
}: PaymentDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const isEditing = entry !== undefined
  // Sin deuda fija arranca con la primera de la lista
  const [selectedDebtId, setSelectedDebtId] = useState(
    () => debts?.[0]?.id ?? ""
  )
  const debt: PaymentDebt | undefined =
    fixedDebt ?? debts?.find((option) => option.id === selectedDebtId)
  const kind = debt?.kind ?? "loan"
  const noun = kind === "receivable" ? "abono" : "pago"

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
                {isEditing ? `Editar ${noun}` : `Registrar ${noun}`}
              </Modal.Heading>
              <p className="text-sm text-muted">
                {isEditing && entry.transaction_id
                  ? "El movimiento enlazado se actualiza con el monto y la fecha."
                  : kind === "receivable"
                    ? "Lo que te pagaron de esta cuenta por cobrar."
                    : "Lo que pagaste de esta deuda."}
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              {!fixedDebt && debts && !isEditing && (
                <DebtSelect
                  debts={debts}
                  value={selectedDebtId}
                  onChange={setSelectedDebtId}
                />
              )}
              {debt && (
                <PaymentForm
                  // Cambiar de deuda reinicia el formulario (tipo y textos)
                  key={debt.id}
                  debt={debt}
                  entry={entry}
                  accounts={accounts}
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

function DebtSelect({
  debts,
  value,
  onChange
}: {
  debts: DebtOption[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Select
      fullWidth
      placeholder="Elige una deuda"
      value={value || null}
      onChange={(key) => onChange(key == null ? "" : String(key))}
      className="mb-4 flex flex-col gap-2"
    >
      <Label>Deuda</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {debts.map((option) => (
            <ListBox.Item
              key={option.id}
              id={option.id}
              textValue={option.name}
            >
              {option.name}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

interface PaymentFormProps {
  debt: PaymentDebt
  entry?: DebtEntry
  accounts: AccountOption[]
  onSaved: () => void
  onCancel: () => void
}

function PaymentForm({
  debt,
  entry,
  accounts,
  onSaved,
  onCancel
}: PaymentFormProps) {
  const isEditing = entry !== undefined
  const isReceivable = debt.kind === "receivable"
  const [occurredOn, setOccurredOn] = useState(
    () => entry?.occurred_on ?? todayISO()
  )

  const [state, formAction, pending] = useActionState<
    PaymentFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isEditing
      ? await updateEntry(prevState, formData)
      : await recordPayment(prevState, formData)

    if (result.ok) {
      const noun = isReceivable ? "Abono" : "Pago"
      toast.success(isEditing ? `${noun} actualizado` : `${noun} registrado`)
      onSaved()
    }
    return result
  }, {})

  const errors = state.fieldErrors
  const values = state.values
  const [createTransaction, setCreateTransaction] = useState(
    () => !values || values.create_transaction === "on"
  )
  const [accountId, setAccountId] = useState("")

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

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={values?.amount ?? amountInput(entry?.amount)}
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
        defaultValue={values?.note ?? entry?.note ?? ""}
        isInvalid={Boolean(errors?.note)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Nota (opcional)</Label>
        <Input
          placeholder={isReceivable ? "Primer abono" : "Cuota de noviembre"}
        />
        <FieldError>{errors?.note?.[0]}</FieldError>
      </TextField>

      {/* El movimiento solo se crea al registrar; al editar, el trigger
          sincroniza el que ya existe */}
      {!isEditing &&
        (debt.kind === "credit_card" ? (
          <p className="rounded-lg bg-default p-3 text-sm text-muted">
            Las compras con tarjeta se registran como gasto al comprar. Este
            pago no crea un movimiento.
          </p>
        ) : (
          <>
            <Checkbox
              name="create_transaction"
              value="on"
              isSelected={createTransaction}
              onChange={setCreateTransaction}
            >
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content className="text-sm">
                {isReceivable
                  ? "Registrar como ingreso"
                  : "Registrar como gasto"}
              </Checkbox.Content>
            </Checkbox>
            {/* La cuenta es la del movimiento: sin él no aplica */}
            {createTransaction && (
              <AccountSelect
                name="account_id"
                label="Cuenta"
                value={accountId}
                onChange={setAccountId}
                accounts={selectableAccounts(accounts)}
                allowNone
                error={errors?.account_id?.[0]}
              />
            )}
          </>
        ))}

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
