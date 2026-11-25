"use client"

import { useId } from "react"
import { CARD_LIST } from "@/components/dashboard/data/surface"
import { FieldHelp } from "@/components/forms/field-label"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldDescription } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { cn } from "@/libs/cn"
import { formatCurrency } from "@/libs/format"
import type { ResultingBalance } from "../balances"

interface BalancesProps {
  title: string
  balances: ResultingBalance[]
  currency: string
}

/** Saldo actual → saldo resultante de cada deuda o meta con filas marcadas */
export function Balances({ title, balances, currency }: BalancesProps) {
  if (balances.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">{title}</h2>
      <ul className={cn(CARD_LIST, "rounded-2xl bg-subtle px-4")}>
        {balances.map((balance) => (
          <li
            key={balance.id}
            className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
          >
            <span>{balance.name}</span>
            <span className="tabular-nums">
              <span className="text-muted-foreground">
                {formatCurrency(balance.current, currency)}
              </span>{" "}
              →{" "}
              <span
                className={cn(
                  "font-medium",
                  balance.result < 0 && "text-(--expense)"
                )}
              >
                {formatCurrency(balance.result, currency)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface CreateTransactionsProps {
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}

/** Casilla para crear el gasto o ingreso de cada pago de préstamo o abono */
export function CreateTransactionsField({
  checked,
  disabled,
  onChange
}: CreateTransactionsProps) {
  const id = useId()

  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-describedby={`${id}-description`}
        className="mt-3"
      />
      <div className="flex flex-col gap-1">
        <div className="flex min-h-11 items-center gap-0.5">
          <Label
            htmlFor={id}
            className="cursor-pointer"
          >
            Registrar también como salida/entrada
          </Label>
          <FieldHelp
            help="import.alsoRegister"
            label="Registrar también el movimiento"
          />
        </div>
        <FieldDescription id={`${id}-description`}>
          Cada pago de préstamo crea una salida en «Deudas». Cada abono de una
          cuenta por cobrar crea una entrada en «Cobros». Desmárcala si ya
          importaste estos pagos como movimientos.
        </FieldDescription>
      </div>
    </div>
  )
}
