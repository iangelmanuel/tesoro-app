"use client"

import { useEffect, useState } from "react"
import { FormDialog } from "@/components/forms/form-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { type DebtEntryEditorData, loadDebtEntryEditor } from "../entry-actions"
import { DebtEntryDialogForm } from "./debt-entry-dialog-form"

interface DebtEntryDialogProps {
  workspaceId: string
  entryId: string
  /** Datos ya cargados (Sheet de la deuda). Sin ellos se piden al abrir */
  initial?: DebtEntryEditorData
  /** Cuentas activas con saldo */
  accounts: PaymentAccountOption[]
  /** Categorías del espacio, para el movimiento enlazado */
  categories: Category[]
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Editar cualquier movimiento de una deuda (SPEC 42, parte 3): pago, abono,
 * compra, avance, cuota de manejo o ajuste. El tipo se puede cambiar y se
 * guarda como si se registrara de nuevo; los campos que pide el tipo nuevo
 * se marcan si faltan. Lo usan el Sheet de la deuda y Movimientos.
 */
export function DebtEntryDialog({
  workspaceId,
  entryId,
  initial,
  accounts,
  categories,
  currency,
  open,
  onOpenChange
}: DebtEntryDialogProps) {
  const [loaded, setLoaded] = useState<DebtEntryEditorData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const data = initial ?? loaded

  // Movimientos no trae el abono completo: se pide al abrir
  useEffect(() => {
    if (!open || initial) return
    let active = true
    loadDebtEntryEditor(entryId).then((result) => {
      if (!active) return
      if ("error" in result) {
        setLoadError(result.error)
      } else {
        setLoadError(null)
        setLoaded(result)
      }
    })
    return () => {
      active = false
    }
  }, [open, initial, entryId])

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-md"
      title="Editar movimiento"
      description={
        data
          ? `${data.debt.name}. Cambia cualquier dato, también el tipo: se guarda como si lo registraras de nuevo.`
          : "Cargando el movimiento..."
      }
    >
      {(close) =>
        data ? (
          <DebtEntryDialogForm
            workspaceId={workspaceId}
            data={data}
            accounts={accounts}
            categories={categories}
            currency={currency}
            onSaved={close}
            onCancel={close}
          />
        ) : loadError ? (
          <p
            role="alert"
            className="text-sm text-destructive"
          >
            {loadError}
          </p>
        ) : (
          <div
            role="status"
            aria-label="Cargando el movimiento"
            className="flex flex-col gap-4"
          >
            <Skeleton className="h-11 rounded-4xl" />
            <Skeleton className="h-11 rounded-4xl" />
            <Skeleton className="h-11 rounded-4xl" />
          </div>
        )
      }
    </FormDialog>
  )
}
