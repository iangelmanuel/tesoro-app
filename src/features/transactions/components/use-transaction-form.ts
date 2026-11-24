"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { amountInput } from "@/components/forms/amount-format"
import { toast } from "@/components/ui/sonner"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import type { IncomeSourceOption } from "@/features/recurring-incomes/queries"
import {
  describeSavedReceipt,
  incomeReceiptValues
} from "@/features/recurring-incomes/receipt"
import { todayISO } from "@/libs/dates"
import { createTransaction, updateTransaction } from "../actions"
import type { TransactionType } from "../filters"
import {
  applyPrefill,
  initialTransactionFields,
  isFormPanel,
  savedToastTitle
} from "../transaction-form-values"
import type {
  EditableTransaction,
  FormPanel,
  RecurringOccurrenceLink,
  TransactionFormState,
  TransactionInitialValues
} from "../types"

interface UseTransactionFormOptions {
  categories: Category[]
  accounts: PaymentAccountOption[]
  transaction?: EditableTransaction
  initialValues?: TransactionInitialValues
  recurring?: RecurringOccurrenceLink
  incomeSources?: IncomeSourceOption[]
  initialPanel?: FormPanel
  onSaved: () => void
}

/**
 * Estado del formulario de movimiento: campos controlados, tab activo,
 * prellenado del ingreso fijo (SPEC 30 y 41) y guardado con toast
 */
export function useTransactionForm({
  categories,
  accounts,
  transaction,
  initialValues,
  recurring,
  incomeSources,
  initialPanel,
  onSaved
}: UseTransactionFormOptions) {
  const isEditing = transaction !== undefined
  const [initial] = useState(() =>
    initialTransactionFields(
      { transaction, initialValues, categories },
      todayISO()
    )
  )

  const [type, setType] = useState<TransactionType>(initial.type)
  const [categoryId, setCategoryId] = useState(initial.category)
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [accountId, setAccountId] = useState(initial.account)
  const [amountText, setAmountText] = useState(initial.amount)
  // Select "Ingreso fijo" (SPEC 30): al elegir uno se prellenan monto,
  // categoría, cuenta y descripción, solo si el usuario no los cambió
  const [incomeSourceId, setIncomeSourceId] = useState(initial.incomeSourceId)
  // Controlada para prellenar "Ingreso {nombre} · {periodo}" (SPEC 41); lo
  // que el usuario escriba se respeta
  const [description, setDescription] = useState(initial.description)
  const [prefilled, setPrefilled] = useState(initial.prefilled)
  // Un movimiento nuevo y suelto también puede ser un traspaso entre dos
  // cuentas propias, un pago de deuda o el pago de un gasto fijo
  const [panel, setPanel] = useState<FormPanel | null>(initialPanel ?? null)

  const [state, formAction, pending] = useActionState<
    TransactionFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isEditing
      ? await updateTransaction(prevState, formData)
      : await createTransaction(prevState, formData)

    if (result.ok) {
      // Con ingreso fijo, el toast describe el reparto que guardó el servidor
      const receipt = describeSavedReceipt(result.allocations ?? [])
      toast.success(
        savedToastTitle({ isEditing, isPayment: Boolean(recurring) }),
        receipt ? { description: receipt } : undefined
      )
      onSaved()
    }
    return result
  }, {})

  function handleTypeChange(values: unknown[]) {
    const [value] = values
    // Un tab ya elegido no se apaga: siempre hay uno activo
    if (!value) return
    if (isFormPanel(value)) {
      setPanel(value)
      return
    }
    setPanel(null)
    if (value === type) return
    setType(value as TransactionType)
    setCategoryId("")
  }

  function handleIncomeSourceChange(value: string) {
    setIncomeSourceId(value)
    const source = incomeSources?.find((option) => option.id === value)
    if (!source) return

    const values = incomeReceiptValues(source, { categories, accounts })
    const next = {
      amount: amountInput(values.amount),
      category: values.category_id ?? "",
      account: values.account_id ?? "",
      description: values.description
    }
    const applied = applyPrefill(
      {
        amount: amountText,
        category: categoryId,
        account: accountId,
        description
      },
      prefilled,
      next
    )

    setAmountText(applied.amount)
    setCategoryId(applied.category)
    setAccountId(applied.account)
    setDescription(applied.description)
    setPrefilled(next)
  }

  // En un teléfono angosto los tabs se desplazan: el activo se lleva a la
  // vista al cambiar de tab
  const tabsRef = useRef<HTMLDivElement>(null)
  const activeTab = panel ?? type
  useEffect(() => {
    tabsRef.current
      ?.querySelector<HTMLElement>("[data-pressed]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [activeTab])

  return {
    initialCategoryUnavailable: initial.initialCategoryUnavailable,
    type,
    panel,
    activeTab,
    tabsRef,
    handleTypeChange,
    categoryId,
    setCategoryId,
    date,
    setDate,
    time,
    setTime,
    accountId,
    setAccountId,
    amountText,
    setAmountText,
    incomeSourceId,
    handleIncomeSourceChange,
    description,
    setDescription,
    state,
    formAction,
    pending
  }
}
