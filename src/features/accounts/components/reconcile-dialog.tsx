"use client"

import { useActionState, useEffect, useState } from "react"
import { HelpHint } from "@/components/dashboard/feedback/help-hint"
import {
  TONE_TEXT_CLASSES,
  type Tone
} from "@/components/dashboard/feedback/tone"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { FormDialog } from "@/components/forms/form-dialog"
import { TextInputField } from "@/components/forms/text-input-field"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import { SITE } from "@/config/site"
import { todayISO } from "@/libs/dates"
import { formatCurrency } from "@/libs/format"
import { getReconcileBalanceAction, reconcileAccountAction } from "../actions"
import { parseSignedAmount } from "../schemas"
import type { AccountWithBalance, ReconcileFormState } from "../types"

interface ReconcileDialogProps {
  account: Pick<AccountWithBalance, "id" | "workspace_id" | "name" | "balance">
  currency: string
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const roundCents = (value: number) => Math.round(value * 100) / 100

/**
 * Cuadrar saldo (SPEC 21 y 48): el usuario escribe el saldo de su banco a una fecha, el
 * diálogo muestra el saldo que calcula Tesoro y la diferencia, y "Crear
 * ajuste" guarda esa diferencia. En el teléfono se pega abajo, como hoja.
 */
export function ReconcileDialog({
  account,
  currency,
  trigger,
  open: controlledOpen,
  onOpenChange
}: ReconcileDialogProps) {
  return (
    <FormDialog
      trigger={trigger}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      bottomOnMobile
      title={
        <span className="flex items-center gap-1">
          Cuadrar saldo de {account.name}
          <HelpHint topic="reconciliation" />
        </span>
      }
      description="Escribe el saldo que ves en tu banco o billetera y la fecha. Tesoro crea un ajuste por la diferencia."
    >
      {(close) => (
        <ReconcileForm
          account={account}
          currency={currency}
          onSaved={close}
          onCancel={close}
        />
      )}
    </FormDialog>
  )
}

interface ReconcileFormProps {
  account: ReconcileDialogProps["account"]
  currency: string
  onSaved: () => void
  onCancel: () => void
}

function ReconcileForm({
  account,
  currency,
  onSaved,
  onCancel
}: ReconcileFormProps) {
  const [state, formAction, pending] = useActionState<
    ReconcileFormState,
    FormData
  >(async (prevState, formData) => {
    const result = await reconcileAccountAction(prevState, formData)

    if (result.ok) {
      toast.success("Saldo cuadrado")
      onSaved()
    }
    return result
  }, {})

  const errors = state.fieldErrors
  const values = state.values
  const today = todayISO()

  const [real, setReal] = useState(values?.balance ?? "")
  const [date, setDate] = useState(values?.occurred_on || today)
  // El saldo a hoy ya viene en la cuenta; otras fechas se piden al servidor
  const [fetched, setFetched] = useState<{
    date: string
    balance: number | null
  }>({ date: today, balance: account.balance })

  useEffect(() => {
    if (!date || date > today || date === today) {
      return
    }

    let cancelled = false
    getReconcileBalanceAction(account.workspace_id, account.id, date).then(
      (result) => {
        if (!cancelled) {
          setFetched({ date, balance: result.balance ?? null })
        }
      }
    )

    return () => {
      cancelled = true
    }
  }, [date, today, account.workspace_id, account.id])

  const calculated =
    date === today
      ? account.balance
      : fetched.date === date
        ? fetched.balance
        : undefined // calculando
  const loading = calculated === undefined

  const realAmount = real.trim() === "" ? Number.NaN : parseSignedAmount(real)
  const hasReal = Number.isFinite(realAmount)
  const difference =
    hasReal && typeof calculated === "number"
      ? roundCents(realAmount - calculated)
      : null

  const tone: Tone =
    difference === null || difference === 0
      ? "neutral"
      : difference > 0
        ? "success"
        : "danger"

  const warn =
    difference !== null &&
    typeof calculated === "number" &&
    Math.abs(difference) > 0 &&
    (Math.abs(difference) > SITE.reconciliation.warnAmount ||
      Math.abs(difference) >
        (Math.abs(calculated) * SITE.reconciliation.warnPercent) / 100)

  const balanced = difference === 0

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      <input
        type="hidden"
        name="workspace_id"
        value={account.workspace_id}
      />
      <input
        type="hidden"
        name="account_id"
        value={account.id}
      />

      <TextInputField
        name="balance"
        label="Saldo en tu banco"
        help="balance.real"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={real}
        onChange={(event) => setReal(event.target.value)}
        isRequired
        error={errors?.balance?.[0]}
      />

      <DatePickerField
        name="occurred_on"
        label="Fecha del saldo"
        help="balance.date"
        value={date}
        onChange={setDate}
        error={errors?.occurred_on?.[0]}
        maxValue={today}
        isRequired
      />

      <dl
        className="flex flex-col gap-2 rounded-2xl bg-subtle p-4 text-sm"
        aria-live="polite"
      >
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">Saldo calculado por Tesoro</dt>
          <dd className="font-medium tabular-nums">
            {loading
              ? "Calculando..."
              : calculated === null
                ? "No disponible"
                : formatCurrency(calculated, currency, 2)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">Diferencia</dt>
          <dd
            className={`font-semibold tabular-nums ${TONE_TEXT_CLASSES[tone]}`}
          >
            {difference === null
              ? "—"
              : `${difference > 0 ? "+" : ""}${formatCurrency(difference, currency, 2)}`}
          </dd>
        </div>
      </dl>

      {balanced && (
        <p
          role="status"
          className="text-sm text-muted-foreground"
        >
          La cuenta ya cuadra
        </p>
      )}

      {warn && (
        <p
          role="status"
          className={`text-sm ${TONE_TEXT_CLASSES.warning}`}
        >
          Probablemente faltan movimientos por registrar
        </p>
      )}

      {state.error && (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={pending || difference === null || balanced}
        >
          {pending ? "Guardando..." : "Crear ajuste"}
        </Button>
      </div>
    </form>
  )
}
