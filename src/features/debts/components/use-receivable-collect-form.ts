"use client"

import { useActionState, useState } from "react"
import { useHideAmounts } from "@/components/dashboard/hide-amounts/hide-amounts-context"
import { amountInput } from "@/components/forms/amount-format"
import { toast } from "@/components/ui/sonner"
import { parsePaymentAmount } from "@/features/accounts/components/payment-account-section"
import { AMOUNT_MASK, formatCurrency } from "@/libs/format"
import { collectReceivable } from "../receivable-actions"
import { type CollectableReceivable, openPeriods } from "../receivable-collect"
import {
  collectDescription,
  collectPreview,
  collectToast,
  collectedPeriods,
  initialCollectPeriod,
  receivableSummary,
  remainingOf
} from "../receivable-collect-form-values"
import {
  COLLECT_MODES_BY_SCHEDULE,
  type ReceivableCollectMode
} from "../receivable-schemas"
import type { PaymentFormState } from "../types"

/** Monto como texto, o `***` con las cifras ocultas */
export function useMoney() {
  const { hidden } = useHideAmounts()
  return (value: number) => (hidden ? AMOUNT_MASK : formatCurrency(value))
}

/** Saldo o "N cuotas por cobrar · $ Z" de una cuenta por cobrar */
export function useReceivableSummary() {
  const money = useMoney()
  return (receivable: CollectableReceivable) =>
    receivableSummary(receivable, money)
}

/**
 * Estado del cobro de una cuenta por cobrar (SPEC 39 y 41): modo, cuota,
 * monto, fecha, la vista previa del reparto, la descripción y la nota
 * sugeridas (siguen al modo y las cuotas mientras el usuario no las cambie) y
 * el guardado con su toast
 */
export function useReceivableCollectForm({
  receivable,
  periodOn,
  onSaved
}: {
  receivable: CollectableReceivable
  periodOn?: string
  onSaved: () => void
}) {
  const modes = COLLECT_MODES_BY_SCHEDULE[receivable.schedule]
  const open = openPeriods(receivable)
  const monthly = receivable.schedule === "monthly"

  const [mode, setMode] = useState<ReceivableCollectMode>(modes[0])
  const [period, setPeriod] = useState(() =>
    initialCollectPeriod(open, periodOn)
  )
  const [amountText, setAmountText] = useState(() =>
    monthly ? amountInput(remainingOf(open, period)) : ""
  )

  const [state, formAction, pending] = useActionState<
    PaymentFormState,
    FormData
  >(async (prevState, formData) => {
    const result = await collectReceivable(prevState, formData)
    if (result.ok) {
      toast.success(collectToast(mode))
      onSaved()
    }
    return result
  }, {})
  const errors = state.fieldErrors

  const isFull = mode === "full"
  const amount = isFull ? receivable.balance : parsePaymentAmount(amountText)
  const preview = collectPreview(mode, receivable, amount)
  // El error del servidor manda; si no hay, el de la vista previa
  const amountError = errors?.amount?.[0] ?? preview?.error ?? undefined

  const suggestedDescription = collectDescription(
    receivable.name,
    collectedPeriods(mode, period, preview)
  )
  const [typedDescription, setTypedDescription] = useState<string | null>(
    () => state.values?.description ?? null
  )
  const [typedNote, setTypedNote] = useState<string | null>(
    () => state.values?.note ?? null
  )

  function changeMode(next: ReceivableCollectMode) {
    setMode(next)
    // Una cuota vuelve a prellenar con lo que falta de la cuota elegida
    if (next === "single") {
      setAmountText(amountInput(remainingOf(open, period)))
    }
  }

  function changePeriod(next: string) {
    setPeriod(next)
    setAmountText(amountInput(remainingOf(open, next)))
  }

  return {
    modes,
    open,
    monthly,
    mode,
    changeMode,
    period,
    changePeriod,
    amountText,
    setAmountText,
    state,
    formAction,
    pending,
    isFull,
    amount,
    preview,
    amountError,
    description: typedDescription ?? suggestedDescription,
    setTypedDescription,
    note: typedNote ?? suggestedDescription,
    setTypedNote
  }
}
