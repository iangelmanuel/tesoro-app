"use client"

import { SelectField } from "@/components/forms/select-field"
import { OTHER_INCOME } from "../constants"
import type { IncomeSourceOption } from "../queries"

/** Enlace actual del movimiento que se edita */
export interface CurrentIncomeLink {
  id: string
}

interface IncomeSourceFieldProps {
  /** Ingresos fijos activos */
  sources: IncomeSourceOption[]
  /** id del ingreso fijo u OTHER_INCOME */
  value: string
  onChange: (value: string) => void
  /** Al editar: el enlace guardado se conserva si no cambia el select */
  current?: CurrentIncomeLink | null
}

// Fuente enlazada que ya no está en la lista (pausada o terminada)
const CURRENT_LABEL = "Ingreso fijo actual"

/**
 * Select "Ingreso fijo" del tab Ingreso (solo Personal). El reparto entre
 * ocurrencias se muestra bajo el monto (IncomeReceiptPreview)
 */
export function IncomeSourceField({
  sources,
  value,
  onChange,
  current
}: IncomeSourceFieldProps) {
  const selected = sources.find((source) => source.id === value)
  const showCurrent =
    current != null && !sources.some((source) => source.id === current.id)
  const hint =
    selected?.frequency === "none"
      ? "Sin fecha fija: suma a lo recibido del mes"
      : null

  return (
    <div className="flex flex-col gap-2">
      <input
        type="hidden"
        name="recurring_income_id"
        value={value}
      />
      <SelectField
        label="Ingreso fijo"
        help="recurringIncome.source"
        value={value}
        onChange={onChange}
        options={[
          { value: OTHER_INCOME, label: "Otra entrada" },
          ...(showCurrent ? [{ value: current.id, label: CURRENT_LABEL }] : []),
          ...sources.map((source) => ({ value: source.id, label: source.name }))
        ]}
      />
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}
