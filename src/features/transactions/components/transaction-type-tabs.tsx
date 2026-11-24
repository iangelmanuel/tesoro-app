"use client"

import { useId } from "react"
import { FieldLabel } from "@/components/forms/field-label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { WorkspaceType } from "@/features/workspaces/types"
import { cn } from "@/libs/cn"
import type { TransactionType } from "../filters"
import { TRANSACTION_COPY } from "../transaction-form-values"
import type { FormPanel } from "../types"

interface TransactionTypeTabsProps {
  workspaceType: WorkspaceType
  /** Tab activo: el tipo o el panel elegido */
  value: TransactionType | FormPanel
  onValueChange: (values: unknown[]) => void
  /** Un pago de gasto fijo siempre es un gasto: el selector se bloquea */
  disabled: boolean
  canTransfer: boolean
  /** Muestra Gasto fijo, Deuda, Me deben y Meta */
  showPaymentTabs: boolean
  tabsRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Selector de tipo del diálogo de movimiento. Orden de los tabs (SPEC 30, 39
 * y 41). Personal: Gasto, Ingreso, Traspaso, Gasto fijo, Deuda, Me deben y
 * Meta. Empresa: Venta, Costo o gasto y Traspaso
 */
export function TransactionTypeTabs({
  workspaceType,
  value,
  onValueChange,
  disabled,
  canTransfer,
  showPaymentTabs,
  tabsRef
}: TransactionTypeTabsProps) {
  const typeLabelId = useId()
  const copy = TRANSACTION_COPY[workspaceType]
  const isBusiness = workspaceType === "business"

  const tab = (id: TransactionType | FormPanel, label: string) => (
    <ToggleGroupItem
      key={id}
      value={id}
      className="h-full flex-1 px-2.5 whitespace-nowrap data-pressed:bg-card data-pressed:font-semibold data-pressed:text-foreground data-pressed:shadow-(--surface-shadow) dark:data-pressed:bg-highlight"
    >
      {label}
    </ToggleGroupItem>
  )

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel
        id={typeLabelId}
        help="transaction.type"
      >
        Tipo
      </FieldLabel>
      {/* Con los tabs de pago son 7 opciones. Desde sm caben en el diálogo; en
        un teléfono angosto se desplazan en horizontal, sin barra visible */}
      <div
        ref={tabsRef}
        className={cn(
          showPaymentTabs &&
            "-mx-1 [scrollbar-width:none] overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden"
        )}
      >
        <ToggleGroup
          value={[value]}
          onValueChange={onValueChange}
          disabled={disabled}
          aria-labelledby={typeLabelId}
          spacing={1}
          className={cn(
            "h-12 w-full rounded-4xl bg-subtle p-0.5 dark:bg-card",
            showPaymentTabs && "w-max min-w-full"
          )}
        >
          {isBusiness
            ? tab("income", copy.income)
            : tab("expense", copy.expense)}
          {isBusiness
            ? tab("expense", copy.expense)
            : tab("income", copy.income)}
          {canTransfer && tab("transfer", "Traspaso")}
          {showPaymentTabs && tab("recurring", "Gasto fijo")}
          {showPaymentTabs && tab("debt_payment", "Deuda")}
          {showPaymentTabs && tab("receivable", "Me deben")}
          {showPaymentTabs && tab("goal", "Meta")}
        </ToggleGroup>
      </div>
    </div>
  )
}
