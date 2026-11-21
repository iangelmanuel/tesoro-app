"use client"

import { useHideAmounts } from "@/components/dashboard/hide-amounts/hide-amounts-context"
import { SelectField } from "@/components/forms/select-field"
import { AMOUNT_MASK, formatCurrency, formatDate } from "@/libs/format"
import { OCCURRENCE_STATUS } from "../occurrences"
import type { UpcomingPayment } from "../queries"

/** Clave de una ocurrencia: gasto fijo y fecha de vencimiento */
export function paymentKey(payment: UpcomingPayment) {
  return `${payment.recurringExpenseId}|${payment.dueOn}`
}

/** La elegida o, sin elección, la primera (la más vencida) */
export function selectedPayment(payments: UpcomingPayment[], key: string) {
  return payments.find((payment) => paymentKey(payment) === key) ?? payments[0]
}

interface OccurrenceSelectProps {
  /** Ocurrencias sin pagar, vencidas primero */
  payments: UpcomingPayment[]
  selected: UpcomingPayment | undefined
  onChange: (key: string) => void
}

/** Select de ocurrencias pendientes de gastos fijos, con monto y estado */
export function OccurrenceSelect({
  payments,
  selected,
  onChange
}: OccurrenceSelectProps) {
  const { hidden } = useHideAmounts()

  return (
    <SelectField
      label="Gasto fijo"
      help="occurrence.select"
      value={selected ? paymentKey(selected) : ""}
      onChange={onChange}
      options={payments.map((payment) => ({
        value: paymentKey(payment),
        label: `${payment.name} · ${formatDate(payment.dueOn)}`,
        description: `${hidden ? AMOUNT_MASK : formatCurrency(payment.amount)} · ${OCCURRENCE_STATUS[payment.status].label}`
      }))}
    />
  )
}
