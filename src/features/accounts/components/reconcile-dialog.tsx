"use client"

import { useActionState, useEffect, useState } from "react"
import {
  Button,
  FieldError,
  Input,
  Label,
  Modal,
  TextField,
  toast
} from "@heroui/react"
import { HelpHint } from "@/components/dashboard/help-hint"
import { TONE_TEXT_CLASSES, type Tone } from "@/components/dashboard/tone"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { SITE } from "@/config/site"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { todayISO } from "@/libs/dates"
import { formatCurrency } from "@/libs/format"
import { getReconcileBalanceAction, reconcileAccountAction } from "../actions"
import { parseSignedAmount } from "../schemas"
import type { AccountWithBalance, ReconcileFormState } from "../types"

interface ReconcileDialogProps {
  account: Pick<AccountWithBalance, "id" | "workspace_id" | "name" | "balance">
  currency: string
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const roundCents = (value: number) => Math.round(value * 100) / 100

/**
 * Conciliar (SPEC 21): el usuario escribe el saldo real a una fecha, el
 * diálogo muestra el saldo que calcula Tesoro y la diferencia, y "Crear
 * ajuste" guarda esa diferencia. En móvil se abre como hoja inferior.
 */
export function ReconcileDialog({
  account,
  currency,
  trigger,
  open: controlledOpen,
  onOpenChange
}: ReconcileDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const isMobile = useIsMobile()

  return (
    <Modal
      isOpen={open}
      onOpenChange={setOpen}
    >
      {trigger}
      <Modal.Backdrop>
        <Modal.Container
          scroll="outside"
          placement={isMobile ? "bottom" : "center"}
        >
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-1">
                Conciliar {account.name}
                <HelpHint topic="reconciliation" />
              </Modal.Heading>
              <p className="text-sm text-muted">
                Escribe el saldo real que ves en tu banco o billetera y la
                fecha. Tesoro crea un ajuste por la diferencia.
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              <ReconcileForm
                account={account}
                currency={currency}
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
      toast.success("Cuenta conciliada")
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

      <TextField
        name="balance"
        inputMode="decimal"
        autoComplete="off"
        value={real}
        onChange={setReal}
        isRequired
        isInvalid={Boolean(errors?.balance)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Saldo real</Label>
        <Input
          placeholder="0"
          className="min-h-11"
        />
        <FieldError>{errors?.balance?.[0]}</FieldError>
      </TextField>

      <DatePickerField
        name="occurred_on"
        label="Fecha del saldo"
        value={date}
        onChange={setDate}
        error={errors?.occurred_on?.[0]}
        maxValue={today}
        isRequired
      />

      <dl
        className="flex flex-col gap-2 rounded-2xl bg-default p-4 text-sm"
        aria-live="polite"
      >
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">Saldo calculado por Tesoro</dt>
          <dd className="font-medium tabular-nums">
            {loading
              ? "Calculando..."
              : calculated === null
                ? "No disponible"
                : formatCurrency(calculated, currency, 2)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">Diferencia</dt>
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
          className="text-sm text-muted"
        >
          La cuenta ya cuadra
        </p>
      )}

      {warn && (
        <p
          role="status"
          className="text-sm text-warning"
        >
          Probablemente faltan movimientos por registrar
        </p>
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
          className="max-md:min-h-11"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          isDisabled={pending || difference === null || balanced}
          className="max-md:min-h-11"
        >
          {pending ? "Guardando..." : "Crear ajuste"}
        </Button>
      </div>
    </form>
  )
}
