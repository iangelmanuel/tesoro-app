"use client"

import { Amount } from "@/components/dashboard/amount"
import { shortOccurrenceDate } from "../occurrences"
import type { IncomeSourceOption } from "../queries"
import { describeOccurrences, previewIncomeReceipt } from "../receipt"
import type { IncomeAllocation } from "../types"

interface IncomeReceiptPreviewProps {
  source: IncomeSourceOption
  /** Monto escrito; NaN o 0 no muestra nada */
  amount: number
  /** Al editar: lo que este ingreso ya tenía asignado (no cuenta) */
  own?: IncomeAllocation[]
  /** El campo ya muestra el error del servidor: no se repite */
  hideError?: boolean
}

/**
 * Bajo el monto del tab Ingreso: cómo se repartiría entre las ocurrencias del
 * ingreso fijo ("Cubre sáb 1 nov, sáb 8 nov · Abona $ 20.000 a sáb 15 nov").
 * Solo anticipa: el servidor reparte al guardar con la misma regla.
 */
export function IncomeReceiptPreview({
  source,
  amount,
  own = [],
  hideError = false
}: IncomeReceiptPreviewProps) {
  if (source.frequency === "none" || !(amount > 0)) {
    return null
  }

  const { covered, partial, error } = previewIncomeReceipt(source, amount, own)

  if (error) {
    if (hideError) {
      return null
    }
    return (
      <p
        aria-live="polite"
        className="text-sm text-danger"
      >
        {error}
      </p>
    )
  }

  return (
    <p
      aria-live="polite"
      className="text-sm text-muted"
    >
      {covered.length > 0 && <>Cubre {describeOccurrences(covered)}</>}
      {covered.length > 0 && partial && " · "}
      {partial && (
        <>
          Abona <Amount value={partial.amount} /> a{" "}
          {shortOccurrenceDate(partial.key)}
        </>
      )}
    </p>
  )
}
