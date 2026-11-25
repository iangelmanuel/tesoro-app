"use client"

import { useState } from "react"
import { Amount } from "@/components/dashboard/data/amount"
import { TONE_TEXT_CLASSES } from "@/components/dashboard/feedback/tone"
import { TextInputField } from "@/components/forms/text-input-field"
import { parseAmount } from "@/features/transactions/schemas"
import { cn } from "@/libs/cn"
import { formatDate, formatMonthLong } from "@/libs/format"
import { type DebtProjection, debtProjection, formatRate } from "../projection"
import type { Debt } from "../queries"

/** Datos del tipo de deuda, solo los que tienen valor */
export function DebtSheetDetails({
  debt,
  currency
}: {
  debt: Debt
  currency: string
}) {
  const rate =
    debt.interest_rate !== null && debt.rate_type !== null
      ? formatRate(debt.interest_rate, debt.rate_type)
      : null

  const rows: [string, React.ReactNode | null][] =
    debt.kind === "credit_card"
      ? [
          ["Entidad", debt.counterparty],
          [
            "Cupo",
            debt.credit_limit !== null ? (
              <Amount
                value={debt.credit_limit}
                currency={currency}
              />
            ) : null
          ],
          ["Tasa", rate ?? "Sin tasa"],
          [
            "Pago mínimo",
            debt.min_payment !== null ? (
              <Amount
                value={debt.min_payment}
                currency={currency}
              />
            ) : (
              "Sin pago mínimo"
            )
          ],
          ["Día de pago", debt.due_day !== null ? `Día ${debt.due_day}` : null],
          [
            "Día de corte",
            debt.closing_day !== null ? `Día ${debt.closing_day}` : null
          ]
        ]
      : debt.kind === "loan"
        ? [
            ["Entidad", debt.counterparty],
            [
              "Cuota",
              debt.installment !== null ? (
                <Amount
                  value={debt.installment}
                  currency={currency}
                />
              ) : null
            ],
            ["Tasa", rate],
            [
              "Día de pago",
              debt.due_day !== null ? `Día ${debt.due_day}` : null
            ],
            [
              "Monto original",
              debt.original_amount !== null ? (
                <Amount
                  value={debt.original_amount}
                  currency={currency}
                />
              ) : null
            ],
            [
              "Plazo",
              debt.term_months !== null ? `${debt.term_months} meses` : null
            ]
          ]
        : debt.schedule === "monthly"
          ? [
              ["Deudor", debt.counterparty],
              [
                "Monto mensual",
                debt.installment !== null ? (
                  <Amount
                    value={debt.installment}
                    currency={currency}
                  />
                ) : null
              ],
              [
                "Día de pago",
                debt.due_day !== null ? `Día ${debt.due_day}` : null
              ],
              [
                "Inicio",
                debt.starts_on !== null ? formatDate(debt.starts_on) : null
              ],
              [
                "Cuotas",
                debt.term_months !== null
                  ? String(debt.term_months)
                  : "Sin fecha de fin"
              ],
              [
                "Total",
                debt.term_months !== null ? (
                  <Amount
                    value={debt.opening_balance}
                    currency={currency}
                  />
                ) : null
              ]
            ]
          : [
              ["Deudor", debt.counterparty],
              [
                "Monto prestado",
                <Amount
                  key="opening"
                  value={debt.opening_balance}
                  currency={currency}
                />
              ],
              [
                "Fecha esperada",
                debt.expected_on !== null ? formatDate(debt.expected_on) : null
              ]
            ]

  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
      {rows
        .filter((row): row is [string, React.ReactNode] => row[1] !== null)
        .map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between gap-2 sm:flex-col sm:justify-start"
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
    </dl>
  )
}

/** Meses, mes de pago total e intereses, o el aviso que aplique */
export function DebtSheetProjection({
  projection,
  currency
}: {
  projection: DebtProjection | null
  currency: string
}) {
  if (projection === null) {
    return null
  }

  switch (projection.kind) {
    case "needs_min_payment":
      return (
        <p className="text-sm text-muted-foreground">
          Agrega el pago mínimo para ver la proyección
        </p>
      )
    case "no_progress":
      return (
        <p className={cn("text-sm font-medium", TONE_TEXT_CLASSES.danger)}>
          Con este pago la deuda no baja
        </p>
      )
    case "too_long":
      return (
        <p className={cn("text-sm font-medium", TONE_TEXT_CLASSES.warning)}>
          Más de 50 años
        </p>
      )
    case "ok":
      return (
        <div className="flex flex-col gap-2">
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div className="flex flex-col">
              <dt className="text-muted-foreground">Meses</dt>
              <dd className="font-medium tabular-nums">{projection.months}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-muted-foreground">Terminas en</dt>
              <dd className="font-medium">
                {formatMonthLong(projection.payoffMonth)}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-muted-foreground">Intereses</dt>
              <dd className="font-medium tabular-nums">
                <Amount
                  value={projection.totalInterest}
                  currency={currency}
                />
              </dd>
            </div>
          </dl>
          {projection.withoutRate && (
            <p className="text-xs text-muted-foreground">
              Sin tasa, la proyección no incluye intereses
            </p>
          )}
        </div>
      )
  }
}

/** "Simula un pago mensual": recalcula la proyección sin guardar nada */
export function DebtSheetSimulator({
  debt,
  currency
}: {
  debt: Debt
  currency: string
}) {
  const [value, setValue] = useState("")
  const payment = parseAmount(value)
  const valid = !Number.isNaN(payment) && payment > 0

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-subtle p-3">
      <TextInputField
        label="Simula un pago mensual"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {valid && (
        <DebtSheetProjection
          projection={debtProjection(debt, payment)}
          currency={currency}
        />
      )}
    </div>
  )
}
