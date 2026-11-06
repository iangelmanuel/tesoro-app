"use client"

import { Label, ListBox, Select } from "@heroui/react"
import { OTHER_INCOME } from "../constants"
import { occurrenceLabel } from "../occurrences"
import type { IncomeSourceOption } from "../queries"

/** Enlace actual del movimiento que se edita */
export interface CurrentIncomeLink {
  id: string
  dueOn: string | null
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
 * Select "Ingreso fijo" del tab Ingreso (solo Personal). Bajo el select, la
 * ocurrencia a la que se enlaza el movimiento. La resuelve el servidor: aquí
 * solo se anticipa con `nextDueOn`
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

  let hint: string | null = null
  if (value === current?.id) {
    // Sin cambiar el select se conserva el enlace guardado
    hint =
      current.dueOn !== null && selected
        ? occurrenceLabel(selected.frequency, current.dueOn)
        : null
  } else if (selected) {
    if (selected.frequency === "none") {
      hint = "Sin fecha fija: suma a lo recibido del mes"
    } else if (selected.nextDueOn !== null) {
      hint = occurrenceLabel(selected.frequency, selected.nextDueOn)
    } else {
      hint = "No tiene ingresos pendientes: queda enlazado sin fecha"
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="hidden"
        name="recurring_income_id"
        value={value}
      />
      <Select
        fullWidth
        value={value}
        onChange={(key) => onChange(key == null ? OTHER_INCOME : String(key))}
        className="flex flex-col gap-2"
      >
        <Label>Ingreso fijo</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item
              id={OTHER_INCOME}
              textValue="Otro ingreso"
            >
              Otro ingreso
              <ListBox.ItemIndicator />
            </ListBox.Item>
            {showCurrent ? (
              <ListBox.Item
                id={current.id}
                textValue={CURRENT_LABEL}
              >
                {CURRENT_LABEL}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ) : null}
            {sources.map((source) => (
              <ListBox.Item
                key={source.id}
                id={source.id}
                textValue={source.name}
              >
                {source.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  )
}
