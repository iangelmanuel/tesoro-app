"use client"

import { useId } from "react"
import { FieldHelp } from "@/components/forms/field-label"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

/**
 * "Registrar como entrada / salida": si el pago o cobro de una deuda crea su
 * movimiento en Movimientos (campo `create_transaction`)
 */
export function CreateTransactionCheckbox({
  checked,
  onCheckedChange,
  income
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Entrada (cuenta por cobrar) o salida (préstamo) */
  income: boolean
}) {
  const id = useId()

  return (
    <div className="flex min-h-11 items-center gap-0.5">
      <Checkbox
        id={id}
        name="create_transaction"
        value="on"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
      <Label
        htmlFor={id}
        className="min-h-11 pl-3 font-normal"
      >
        {income ? "Registrar como entrada" : "Registrar como salida"}
      </Label>
      <FieldHelp
        help="debtEntry.createTransaction"
        label="Registrar el movimiento"
      />
    </div>
  )
}
