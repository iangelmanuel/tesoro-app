"use client"

import { useActionState, useState } from "react"
import { amountInput } from "@/components/forms/amount-format"
import { toast } from "@/components/ui/sonner"
import { activeAccountId } from "@/features/accounts/active-account"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import {
  recordAdvance,
  recordDebtCharge,
  recordPayment
} from "../entry-actions"
import {
  type PaymentDebt,
  type PaymentInitialValues,
  type PaymentMode,
  initialPaymentMode,
  keepsPrefill,
  paymentAction,
  paymentModes,
  paymentToast,
  prefilledAccount,
  prefilledAmount,
  prefilledDescription,
  prefilledNote
} from "../payment-form-values"
import type { PaymentFormState } from "../types"

/**
 * Texto prellenado: `replace` lo cambia solo si el usuario no lo tocó (está
 * vacío o sigue con el último prellenado). Sin texto nuevo, no cambia
 */
function usePrefilledText(initial: () => string) {
  const [value, setValue] = useState(initial)
  const [prefilled, setPrefilled] = useState(value)
  function replace(next: string | undefined) {
    if (next === undefined || !keepsPrefill(value, prefilled)) return
    setValue(next)
    setPrefilled(next)
  }
  return { value, setValue, replace }
}

/**
 * Estado del formulario de un movimiento nuevo de una deuda (SPEC 41, 46 y
 * 49): tipo, monto, cuenta, descripción y nota con su prellenado, y el
 * guardado con su toast. Al cambiar de tipo, cada texto prellenado se
 * reemplaza si el usuario no lo tocó.
 */
export function usePaymentDialog({
  debt,
  accounts,
  initialValues,
  onSaved
}: {
  debt: PaymentDebt
  accounts: PaymentAccountOption[]
  initialValues?: PaymentInitialValues
  onSaved: () => void
}) {
  const modes = paymentModes(debt.kind)
  const initialMode = initialPaymentMode(modes, initialValues)
  const [mode, setMode] = useState<PaymentMode>(initialMode)

  const [state, formAction, pending] = useActionState<
    PaymentFormState,
    FormData
  >(async (prevState, formData) => {
    const action = paymentAction(mode)
    const result =
      action === "advance"
        ? await recordAdvance(prevState, formData)
        : action === "payment"
          ? await recordPayment(prevState, formData)
          : await recordDebtCharge(prevState, formData)

    if (result.ok) {
      toast.success(paymentToast(mode, debt.kind))
      onSaved()
    }
    return result
  }, {})

  const values = state.values
  const amount = usePrefilledText(
    () =>
      values?.amount ??
      (initialValues
        ? amountInput(initialValues.amount)
        : prefilledAmount("payment", debt.descriptions))
  )
  // Un duplicado lleva movimiento si el original lo tenía (con descripción)
  const [createTransaction, setCreateTransaction] = useState(() =>
    values
      ? values.create_transaction === "on"
      : !initialValues || initialValues.description !== ""
  )
  // Cuenta por defecto de la deuda, si sigue activa (SPEC 41)
  const accountContext = {
    initialValues,
    initialMode,
    defaultAccountId: activeAccountId(accounts, debt.account_id) ?? ""
  }
  const [accountId, setAccountId] = useState(() =>
    prefilledAccount(initialMode, accountContext)
  )
  const description = usePrefilledText(
    () =>
      values?.description ??
      initialValues?.description ??
      prefilledDescription("payment", debt.descriptions) ??
      ""
  )
  const note = usePrefilledText(
    () =>
      values?.note ??
      initialValues?.note ??
      prefilledNote("payment", debt.descriptions)
  )

  function changeMode(next: PaymentMode) {
    setMode(next)
    // El avance arranca sin cuenta: la cuenta por defecto es la que paga la
    // tarjeta, no la que recibe un avance
    if ((next === "advance") !== (mode === "advance")) {
      setAccountId(prefilledAccount(next, accountContext))
    }
    amount.replace(prefilledAmount(next, debt.descriptions))
    note.replace(prefilledNote(next, debt.descriptions))
    description.replace(prefilledDescription(next, debt.descriptions))
  }

  return {
    modes,
    mode,
    changeMode,
    state,
    formAction,
    pending,
    amount,
    note,
    description,
    createTransaction,
    setCreateTransaction,
    accountId,
    setAccountId,
    /** Cuenta con la que arranca la sección de la cuenta en el tipo actual */
    defaultAccountId: prefilledAccount(mode, accountContext)
  }
}
