import { formatNumber } from "@/libs/format"

/** Monto para un input en es-CO ("1.500.000"); "" si no hay */
export function amountInput(value: number | null | undefined) {
  return value === null || value === undefined
    ? ""
    : formatNumber(value, { maximumFractionDigits: 2 })
}

/** Tasa para un input con coma decimal ("28,5"); "" si no hay */
export function rateInput(value: number | null | undefined) {
  return value === null || value === undefined
    ? ""
    : formatNumber(value, { maximumFractionDigits: 3, useGrouping: false })
}
