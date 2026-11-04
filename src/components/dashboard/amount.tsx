"use client"

import { cn } from "@heroui/react"
import { AMOUNT_MASK, formatCurrency } from "@/libs/format"
import { useHideAmounts } from "./hide-amounts-context"

interface AmountProps {
  value: number
  /** Código ISO de la moneda del espacio */
  currency?: string
  /** Fuerza los decimales (p. ej. 2 al conciliar) */
  fractionDigits?: number
  className?: string
}

/**
 * Único punto de formato de saldos y totales. Con las cifras ocultas muestra
 * `***` en lugar del número: el valor real no llega al DOM ni al lector de
 * pantalla.
 */
export function Amount({
  value,
  currency = "COP",
  fractionDigits,
  className
}: Readonly<AmountProps>) {
  const { hidden } = useHideAmounts()
  const text = formatCurrency(value, currency, fractionDigits)

  if (!hidden) {
    return <span className={cn("tabular-nums", className)}>{text}</span>
  }

  return (
    <span
      role="img"
      aria-label="Monto oculto"
      className={cn("tabular-nums", className)}
    >
      {AMOUNT_MASK}
    </span>
  )
}
