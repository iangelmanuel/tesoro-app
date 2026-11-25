"use client"

import { useActionState, useState } from "react"
import { toast } from "@/components/ui/sonner"
import { parseAmount } from "@/features/transactions/schemas"
import {
  adoptLinkable,
  entryFormFlags,
  initialEntryForm,
  missingEntryFields,
  projectedBalance
} from "../debt-entry-form-values"
import { type EntryEditorDebt, updateDebtEntry } from "../entry-actions"
import {
  type AdjustmentDirection,
  type EntryType,
  entryTypesFor
} from "../entry-types"
import type { DebtEntry, LinkableTransaction } from "../queries"
import type { PaymentFormState } from "../types"

/**
 * Estado del editor de un movimiento de deuda (SPEC 42, parte 3): los campos
 * del movimiento, qué pide el tipo elegido, el saldo proyectado, lo que falta
 * y el guardado con su toast
 */
export function useDebtEntryDialog({
  entry,
  debt,
  accounts,
  onSaved
}: {
  entry: DebtEntry
  debt: EntryEditorDebt
  accounts: { id: string; name: string }[]
  onSaved: () => void
}) {
  const [initial] = useState(() => initialEntryForm(entry))
  const types = entryTypesFor(debt, initial.type)

  const [state, formAction, pending] = useActionState<
    PaymentFormState,
    FormData
  >(async (prevState, formData) => {
    const result = await updateDebtEntry(prevState, formData)
    if (result.ok) {
      toast.success("Movimiento actualizado")
      onSaved()
    }
    return result
  }, {})

  const [type, setType] = useState<EntryType>(initial.type)
  const [amountText, setAmountText] = useState(initial.amountText)
  const [direction, setDirection] = useState<AdjustmentDirection>(
    initial.direction
  )
  const [occurredOn, setOccurredOn] = useState(initial.occurredOn)
  const [time, setTime] = useState(initial.time)
  const [note, setNote] = useState(initial.note)
  const [accountId, setAccountId] = useState(initial.accountId)
  const [createTransaction, setCreateTransaction] = useState(
    initial.createTransaction
  )
  const [description, setDescription] = useState(initial.description)
  const [linkId, setLinkId] = useState("")

  const flags = entryFormFlags({
    type,
    debtKind: debt.kind,
    createTransaction,
    entry
  })
  const amount = parseAmount(amountText)
  const validAmount = !Number.isNaN(amount) && amount > 0
  const newBalance = projectedBalance({
    debtBalance: debt.balance,
    entry,
    kind: flags.kind,
    type,
    amount,
    direction
  })
  const accountName =
    accounts.find((account) => account.id === accountId)?.name ?? null
  const missing = missingEntryFields({
    validAmount,
    accountRequired: flags.accountRequired,
    accountId,
    linkId
  })

  function changeType(next: EntryType) {
    setType(next)
    setLinkId("")
  }

  function adopt(candidate: LinkableTransaction | null) {
    setLinkId(candidate?.id ?? "")
    if (!candidate) return
    const patch = adoptLinkable(candidate, flags.isCard && flags.isPayment)
    setAccountId(patch.accountId)
    setOccurredOn(patch.occurredOn)
    setTime(patch.time)
    if (patch.note !== undefined) setNote(patch.note)
    if ("description" in patch) setDescription(patch.description)
  }

  return {
    types,
    state,
    formAction,
    pending,
    type,
    changeType,
    amountText,
    setAmountText,
    direction,
    setDirection,
    occurredOn,
    setOccurredOn,
    time,
    setTime,
    note,
    setNote,
    accountId,
    setAccountId,
    createTransaction,
    setCreateTransaction,
    description,
    setDescription,
    linkId,
    adopt,
    flags,
    amount,
    validAmount,
    newBalance,
    accountName,
    missing
  }
}
