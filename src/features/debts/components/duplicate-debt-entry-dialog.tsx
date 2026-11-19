"use client"

import { useEffect, useEffectEvent, useState } from "react"
import { toast } from "@heroui/react"
import { activeAccountId } from "@/features/accounts/active-account"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { type EntryEditorDebt, loadDebtEntryEditor } from "../actions"
import { entryTypeOf } from "../entry-types"
import type { DebtEntry } from "../queries"
import { PaymentDialog, type PaymentInitialValues } from "./payment-dialog"

/** Movimiento de la deuda que se duplica y su deuda */
export interface DebtEntryDuplicateData {
  entry: DebtEntry
  debt: Pick<EntryEditorDebt, "id" | "kind" | "status" | "schedule">
  /** La cuota del ciclo actual ya está cubierta (préstamos y tarjetas) */
  cycleCovered: boolean
}

/**
 * Se puede duplicar un movimiento de la deuda (SPEC 49): no los ajustes, ni
 * en una deuda que no está activa, ni el cobro de un Me deben mensual (va por
 * su propio diálogo)
 */
export function canDuplicateDebtEntry(
  debt: DebtEntryDuplicateData["debt"],
  entry: Pick<DebtEntry, "kind">
) {
  return (
    entry.kind !== "adjustment" &&
    debt.status === "active" &&
    !(debt.kind === "receivable" && debt.schedule === "monthly")
  )
}

/** Valores del duplicado: mismo tipo, monto, cuenta, textos y cuotas */
export function debtEntryDuplicateValues(
  entry: DebtEntry,
  accounts: PaymentAccountOption[]
): PaymentInitialValues | null {
  const mode = entryTypeOf(entry)
  if (mode === "adjustment") return null
  return {
    mode,
    amount: Math.abs(entry.amount),
    account_id: activeAccountId(accounts, entry.payment_account_id),
    description: entry.description ?? "",
    note: entry.note ?? "",
    installments: entry.installments
  }
}

interface DuplicateDebtEntryDialogProps {
  workspaceId: string
  data: DebtEntryDuplicateData
  accounts: PaymentAccountOption[]
  /** Se monta al elegir Duplicar; al cerrar se desmonta */
  onOpenChange: (open: boolean) => void
}

/**
 * Duplicar un pago, abono, compra, avance o cuota de manejo (SPEC 49): abre
 * el diálogo de registrar de la misma deuda, prellenado con el original y con
 * fecha de hoy
 */
export function DuplicateDebtEntryDialog({
  workspaceId,
  data,
  accounts,
  onOpenChange
}: DuplicateDebtEntryDialogProps) {
  const initialValues = debtEntryDuplicateValues(data.entry, accounts)
  if (!initialValues) return null

  return (
    <PaymentDialog
      workspaceId={workspaceId}
      debt={{
        id: data.debt.id,
        kind: data.debt.kind,
        cycleCovered: data.cycleCovered
      }}
      accounts={accounts}
      initialValues={initialValues}
      open
      onOpenChange={onOpenChange}
    />
  )
}

const CANNOT_DUPLICATE = "Este movimiento no se puede duplicar"

/**
 * Duplicar desde Movimientos (SPEC 49), que no tiene el abono completo: lo
 * lee con loadDebtEntryEditor, igual que Editar (SPEC 42), con el ciclo de la
 * deuda para el aviso de cuota cubierta. Si no se puede, toast y no abre nada
 */
export function DuplicateDebtEntryLoader({
  workspaceId,
  entryId,
  accounts,
  onOpenChange
}: {
  workspaceId: string
  entryId: string
  accounts: PaymentAccountOption[]
  onOpenChange: (open: boolean) => void
}) {
  const [data, setData] = useState<DebtEntryDuplicateData | null>(null)
  const onLoadError = useEffectEvent((message: string) => {
    toast.danger(message)
    onOpenChange(false)
  })

  useEffect(() => {
    let active = true
    loadDebtEntryEditor(entryId, { cycle: true }).then((result) => {
      if (!active) return
      if ("error" in result) {
        onLoadError(result.error)
      } else if (!canDuplicateDebtEntry(result.debt, result.entry)) {
        onLoadError(CANNOT_DUPLICATE)
      } else {
        setData({
          entry: result.entry,
          debt: result.debt,
          cycleCovered: result.debt.cycle_covered === true
        })
      }
    })
    return () => {
      active = false
    }
  }, [entryId])

  if (!data) return null

  return (
    <DuplicateDebtEntryDialog
      workspaceId={workspaceId}
      data={data}
      accounts={accounts}
      onOpenChange={onOpenChange}
    />
  )
}
