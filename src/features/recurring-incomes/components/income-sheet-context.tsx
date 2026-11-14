"use client"

import { createContext, useContext, useState } from "react"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import type { IncomeSourceOption, RecurringIncome } from "../queries"
import { RecurringIncomeSheet } from "./recurring-income-sheet"

const IncomeSheetContext = createContext<((id: string) => void) | null>(null)

interface IncomeSheetProviderProps {
  incomes: RecurringIncome[]
  categories: Category[]
  accounts: PaymentAccountOption[]
  incomeSources: IncomeSourceOption[]
  currency: string
  children: React.ReactNode
}

/**
 * Un solo Sheet de ingreso fijo por página (SPEC 38). Lo abren la fila de la
 * lista de fuentes y la fila resumen del mes (diaria y cada N días).
 */
export function IncomeSheetProvider({
  incomes,
  categories,
  accounts,
  incomeSources,
  currency,
  children
}: IncomeSheetProviderProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  // Al eliminarlo desaparece de la lista: el Sheet se queda sin ingreso
  const selected = incomes.find((income) => income.id === selectedId)

  function openSheet(id: string) {
    setSelectedId(id)
    setOpen(true)
  }

  return (
    <IncomeSheetContext.Provider value={openSheet}>
      {children}
      {selected && (
        <RecurringIncomeSheet
          key={selected.id}
          income={selected}
          categories={categories}
          accounts={accounts}
          incomeSources={incomeSources}
          currency={currency}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </IncomeSheetContext.Provider>
  )
}

/** Abre el Sheet del ingreso fijo `id` */
export function useOpenIncomeSheet() {
  const open = useContext(IncomeSheetContext)
  if (!open) {
    throw new Error(
      "useOpenIncomeSheet debe usarse dentro de <IncomeSheetProvider />"
    )
  }
  return open
}

/**
 * Nombre de la fila resumen como botón que abre el Sheet de su fuente. Va en
 * la lista del mes, que es de servidor.
 */
export function OpenIncomeSheetButton({
  incomeId,
  children
}: {
  incomeId: string
  children: React.ReactNode
}) {
  const open = useOpenIncomeSheet()
  return (
    <button
      type="button"
      onClick={() => open(incomeId)}
      className="min-w-0 rounded-sm text-start font-medium break-words underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus max-md:min-h-11"
    >
      {children}
    </button>
  )
}
