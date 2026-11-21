"use client"

import { cn } from "@/libs/cn"
import { AMOUNT_MASK, formatCurrency, formatNumber } from "@/libs/format"
import { useHideAmounts } from "./hide-amounts-context"

interface AmountProps {
  value: number
  /** Código ISO de la moneda del espacio */
  currency?: string
  /** Fuerza los decimales (p. ej. 2 al conciliar) */
  fractionDigits?: number
  /**
   * Muestra el signo también en positivo ("+ $ 50.000") y lo lee como "más"
   * o "menos": para movimientos que suben o bajan un saldo
   */
  signed?: boolean
  className?: string
}

// Nombre hablado de la moneda para el lector de pantalla. Las que no estén
// aquí se leen por su código ISO
const CURRENCY_NAMES: Record<string, string> = {
  COP: "pesos",
  USD: "dólares",
  EUR: "euros",
  MXN: "pesos mexicanos",
  ARS: "pesos argentinos",
  CLP: "pesos chilenos",
  PEN: "soles"
}

/**
 * El monto como se dice: "menos 120.000 pesos". El signo "−" o "-" lo
 * pronuncia cada lector a su manera (o lo calla), y un gasto tiene que
 * oírse como gasto (SPEC 51 §7)
 */
export function spokenAmount(
  value: number,
  currency = "COP",
  fractionDigits?: number
) {
  const number = formatNumber(Math.abs(value), {
    minimumFractionDigits: fractionDigits ?? 0,
    maximumFractionDigits: fractionDigits ?? 2
  })
  const name = CURRENCY_NAMES[currency] ?? currency
  return `${value < 0 ? "menos " : ""}${number} ${name}`
}

/**
 * Único punto de formato de saldos y totales. El lector de pantalla oye el
 * monto completo con su signo en palabras; lo visible va oculto para él.
 * Con las cifras ocultas muestra `***` y se lee "Monto oculto": el valor
 * real no llega al DOM ni al lector de pantalla.
 */
export function Amount({
  value,
  currency = "COP",
  fractionDigits,
  signed = false,
  className
}: Readonly<AmountProps>) {
  const { hidden } = useHideAmounts()

  if (hidden) {
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

  // Con signo: "+ $ 50.000" / "− $ 50.000", leído "más" / "menos"
  const visible = signed
    ? `${value < 0 ? "−" : "+"} ${formatCurrency(Math.abs(value), currency, fractionDigits)}`
    : formatCurrency(value, currency, fractionDigits)
  const spoken =
    signed && value >= 0
      ? `más ${spokenAmount(value, currency, fractionDigits)}`
      : spokenAmount(value, currency, fractionDigits)

  return (
    <span className={cn("tabular-nums", className)}>
      <span aria-hidden="true">{visible}</span>
      <span className="sr-only">{spoken}</span>
    </span>
  )
}
