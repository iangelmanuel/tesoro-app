"use client"

import { Label, ListBox, Select } from "@heroui/react"
import { formatCurrency, formatDate } from "@/libs/format"
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
  return (
    <Select
      fullWidth
      placeholder="Elige un pago"
      value={selected ? paymentKey(selected) : null}
      onChange={(key) => onChange(key == null ? "" : String(key))}
      className="flex flex-col gap-2"
    >
      <Label>Gasto fijo</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {payments.map((payment) => {
            const key = paymentKey(payment)
            const text = `${payment.name} · ${formatDate(payment.dueOn)}`
            return (
              <ListBox.Item
                key={key}
                id={key}
                textValue={text}
              >
                <div className="flex flex-col">
                  <span>{text}</span>
                  <span className="text-xs text-muted tabular-nums">
                    {formatCurrency(payment.amount)} ·{" "}
                    {OCCURRENCE_STATUS[payment.status].label}
                  </span>
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )
          })}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}
