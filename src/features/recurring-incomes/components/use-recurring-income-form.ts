"use client"

import { useActionState, useState } from "react"
import { amountInput } from "@/components/forms/amount-format"
import { toast } from "@/components/ui/sonner"
import {
  type AccountOption,
  selectableAccounts
} from "@/features/accounts/components/account-select"
import type { Category } from "@/features/categories/queries"
import { todayISO } from "@/libs/dates"
import { createRecurringIncome, updateRecurringIncome } from "../actions"
import {
  type ScheduleDraft,
  initialScheduleDraft,
  withFrequency
} from "../income-schedule"
import type { RecurringIncome } from "../queries"
import type { IncomeFrequency } from "../schemas"
import type { RecurringIncomeFormState } from "../types"

/**
 * Estado del formulario de un ingreso fijo (SPEC 38): opciones activas, el
 * calendario (`draft`) y el guardado con su toast
 */
export function useRecurringIncomeForm({
  categories,
  accounts,
  income,
  onSaved
}: {
  categories: Category[]
  accounts: AccountOption[]
  income?: RecurringIncome
  onSaved: () => void
}) {
  const isEditing = income !== undefined
  // Solo se aceptan categorías de ingreso y cuentas activas
  const categoryOptions = categories.filter(
    (category) => category.type === "income" && category.archived_at === null
  )
  const accountOptions = selectableAccounts(accounts)
  const currentCategoryArchived =
    income !== undefined && income.category.archived_at !== null
  const currentAccountArchived =
    income?.account_id != null &&
    !accountOptions.some((account) => account.id === income.account_id)

  const [categoryId, setCategoryId] = useState(
    currentCategoryArchived ? "" : (income?.category_id ?? "")
  )
  const [accountId, setAccountId] = useState(
    currentAccountArchived ? "" : (income?.account_id ?? "")
  )
  const [amount, setAmount] = useState(amountInput(income?.amount))
  const [draft, setDraft] = useState(() =>
    initialScheduleDraft(income, todayISO())
  )

  const [state, formAction, pending] = useActionState<
    RecurringIncomeFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isEditing
      ? await updateRecurringIncome(prevState, formData)
      : await createRecurringIncome(prevState, formData)

    if (result.ok) {
      toast.success(
        isEditing ? "Ingreso fijo actualizado" : "Ingreso fijo registrado"
      )
      onSaved()
    }
    return result
  }, {})

  function setField<K extends keyof ScheduleDraft>(
    key: K,
    value: ScheduleDraft[K]
  ) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function changeFrequency(next: IncomeFrequency) {
    setDraft((current) => withFrequency(current, next))
  }

  return {
    isEditing,
    categoryOptions,
    accountOptions,
    currentCategoryArchived,
    state,
    formAction,
    pending,
    categoryId,
    setCategoryId,
    accountId,
    setAccountId,
    amount,
    setAmount,
    draft,
    setField,
    changeFrequency
  }
}
