import { Label } from "@/components/ui/label"

/** Etiqueta, control y primer error. Lo comparten los diálogos de deudas. */
export function Field({
  id,
  label,
  errors,
  children
}: {
  id: string
  label: string
  errors?: string[]
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {errors?.length ? (
        <p className="text-sm text-destructive">{errors[0]}</p>
      ) : null}
    </div>
  )
}

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
