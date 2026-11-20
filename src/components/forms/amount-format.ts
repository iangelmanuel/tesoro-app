const AMOUNT_FORMAT = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2
})

const RATE_INPUT_FORMAT = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 3,
  useGrouping: false
})

/** Monto para un input en es-CO ("1.500.000"); "" si no hay */
export function amountInput(value: number | null | undefined) {
  return value === null || value === undefined
    ? ""
    : AMOUNT_FORMAT.format(value)
}

/** Tasa para un input con coma decimal ("28,5"); "" si no hay */
export function rateInput(value: number | null | undefined) {
  return value === null || value === undefined
    ? ""
    : RATE_INPUT_FORMAT.format(value)
}
