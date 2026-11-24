"use client"

import { useId } from "react"
import { FieldLabel } from "@/components/forms/field-label"
import { TextInputField } from "@/components/forms/text-input-field"
import { FieldError } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import type { TransactionType } from "../filters"
import type { RecurringOccurrenceLink } from "../types"

type FieldErrors = Partial<Record<string, string[]>> | undefined

/**
 * Campos ocultos que la action lee: id (al editar), espacio, tipo y la
 * ocurrencia del gasto fijo que se paga
 */
export function TransactionHiddenFields({
  id,
  workspaceId,
  type,
  recurring
}: {
  id?: string
  workspaceId: string
  type: TransactionType
  recurring?: RecurringOccurrenceLink
}) {
  return (
    <>
      {id !== undefined && (
        <input
          type="hidden"
          name="id"
          value={id}
        />
      )}
      <input
        type="hidden"
        name="workspace_id"
        value={workspaceId}
      />
      <input
        type="hidden"
        name="type"
        value={type}
      />
      {recurring && (
        <>
          <input
            type="hidden"
            name="recurring_expense_id"
            value={recurring.recurringExpenseId}
          />
          <input
            type="hidden"
            name="recurring_due_on"
            value={recurring.dueOn}
          />
        </>
      )}
    </>
  )
}

/** Cliente o proveedor y n.º de factura: solo en Empresa */
export function TransactionBusinessFields({
  type,
  counterparty,
  invoiceRef,
  errors
}: {
  type: TransactionType
  /** Valor inicial de cliente o proveedor */
  counterparty: string
  /** Valor inicial del n.º de factura */
  invoiceRef: string
  errors: FieldErrors
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextInputField
        name="counterparty"
        label={
          type === "income" ? "Cliente (opcional)" : "Proveedor (opcional)"
        }
        help="transaction.counterparty"
        maxLength={80}
        autoComplete="off"
        defaultValue={counterparty}
        error={errors?.counterparty?.[0]}
      />

      <TextInputField
        name="invoice_ref"
        label="N.º de factura (opcional)"
        help="transaction.invoice"
        maxLength={40}
        autoComplete="off"
        placeholder="FV-001"
        defaultValue={invoiceRef}
        error={errors?.invoice_ref?.[0]}
      />
    </div>
  )
}

/** Nota opcional del movimiento */
export function TransactionNoteField({
  defaultValue,
  errors
}: {
  defaultValue: string
  errors: FieldErrors
}) {
  const noteId = useId()

  return (
    <div
      className="flex flex-col gap-2"
      data-invalid={errors?.note ? true : undefined}
    >
      <FieldLabel
        htmlFor={noteId}
        help="common.note"
        isInvalid={Boolean(errors?.note)}
      >
        Nota (opcional)
      </FieldLabel>
      <Textarea
        id={noteId}
        name="note"
        rows={3}
        maxLength={500}
        defaultValue={defaultValue}
        aria-invalid={errors?.note ? true : undefined}
        aria-describedby={errors?.note ? `${noteId}-error` : undefined}
      />
      {errors?.note ? (
        <FieldError id={`${noteId}-error`}>{errors.note[0]}</FieldError>
      ) : null}
    </div>
  )
}
