"use client"

import { useState } from "react"
import { Button, Drawer, Input, Label, TextField } from "@heroui/react"
import { Plus, RefreshCw } from "lucide-react"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { parseAmount } from "@/features/transactions/schemas"
import { formatCurrency, formatDate } from "@/libs/format"
import {
  type DebtProjection,
  debtProjection,
  debtStatusLabel,
  formatDayMonth,
  formatMonthYear,
  formatRate,
  isActiveDebt,
  isReceivableOverdue,
  nextFeeDate
} from "../calculations"
import type { Debt, DebtEntry } from "../queries"
import { AdjustBalanceDialog } from "./adjust-balance-dialog"
import { DebtEntriesList } from "./debt-entries-list"
import { ToneBadge } from "./debt-indicators"
import { DebtProgress, ReceivableProgress } from "./debt-progress"
import { PaymentDialog } from "./payment-dialog"
import { useDebtAction } from "./use-debt-action"

interface DebtSheetProps {
  debt: Debt
  entries: DebtEntry[]
  /** Cuentas para el movimiento de un pago nuevo; solo en deudas activas */
  accounts?: PaymentAccountOption[]
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Detalle de una deuda o cuenta por cobrar: resumen, proyección y simulador
 * (tarjetas y préstamos), "Registrar pago" / "Actualizar saldo" e historial.
 * Las pagadas, cobradas o archivadas son de solo lectura, con "Reactivar".
 */
export function DebtSheet({
  debt,
  entries,
  accounts,
  today,
  currency,
  open,
  onOpenChange
}: DebtSheetProps) {
  const isActive = debt.status === "active"
  const isReceivable = debt.kind === "receivable"
  const status = debtStatusLabel(debt)
  const { pending, run } = useDebtAction(debt)

  return (
    <Drawer
      isOpen={open}
      onOpenChange={onOpenChange}
    >
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="w-full sm:max-w-md">
            <Drawer.CloseTrigger aria-label="Cerrar" />
            <Drawer.Header>
              <div className="flex flex-wrap items-center gap-2">
                <Drawer.Heading className="truncate">
                  {debt.name}
                </Drawer.Heading>
                {status && (
                  <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
                )}
                {isReceivableOverdue(debt, today) && (
                  <ToneBadge tone="warning">Vencida</ToneBadge>
                )}
              </div>
              <p className="text-sm text-muted tabular-nums">
                Saldo{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(debt.balance, currency)}
                </span>
              </p>
            </Drawer.Header>
            <Drawer.Body>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                  {isReceivable ? (
                    <ReceivableProgress debt={debt} />
                  ) : (
                    <DebtProgress debt={debt} />
                  )}
                  <DebtDetails
                    debt={debt}
                    currency={currency}
                  />
                  <NextFee
                    debt={debt}
                    today={today}
                    currency={currency}
                  />
                </div>

                {isActiveDebt(debt) && debt.balance > 0 && (
                  <section className="flex flex-col gap-3">
                    <h3 className="text-xs font-medium text-muted uppercase">
                      Proyección
                    </h3>
                    <ProjectionDetails
                      projection={debtProjection(debt)}
                      currency={currency}
                    />
                    <PaymentSimulator
                      debt={debt}
                      currency={currency}
                    />
                  </section>
                )}

                {isActive ? (
                  <div className="grid grid-cols-2 gap-2">
                    <PaymentDialog
                      debt={debt}
                      accounts={accounts}
                      trigger={
                        <Button isDisabled={debt.balance <= 0}>
                          <Plus />
                          {isReceivable ? "Registrar abono" : "Registrar pago"}
                        </Button>
                      }
                    />
                    <AdjustBalanceDialog
                      debt={debt}
                      currency={currency}
                      trigger={
                        <Button variant="outline">
                          <RefreshCw />
                          Actualizar saldo
                        </Button>
                      }
                    />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3">
                    <p className="text-sm text-muted">
                      {status?.label}. Reactívala para registrar{" "}
                      {isReceivable ? "abonos" : "pagos"}.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      isDisabled={pending}
                      onPress={() => run("reactivate")}
                    >
                      Reactivar
                    </Button>
                  </div>
                )}

                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-medium text-muted uppercase">
                    Historial
                  </h3>
                  <DebtEntriesList
                    debt={debt}
                    entries={entries}
                    currency={currency}
                    readOnly={!isActive}
                  />
                </section>
              </div>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  )
}

/** "Próxima cuota: 5 de diciembre · $ 22.000", solo en tarjetas con cuota */
function NextFee({
  debt,
  today,
  currency
}: {
  debt: Debt
  today: string
  currency: string
}) {
  const dueOn = nextFeeDate(debt, today)

  if (dueOn === null || debt.fee_amount === null) {
    return null
  }

  return (
    <p className="text-sm text-muted tabular-nums">
      Próxima cuota: {formatDayMonth(dueOn)} ·{" "}
      <span className="font-medium text-foreground">
        {formatCurrency(debt.fee_amount, currency)}
      </span>
    </p>
  )
}

/** Datos del tipo de deuda, solo los que tienen valor */
function DebtDetails({ debt, currency }: { debt: Debt; currency: string }) {
  const rate =
    debt.interest_rate !== null && debt.rate_type !== null
      ? formatRate(debt.interest_rate, debt.rate_type)
      : null

  const rows: [string, string | null][] =
    debt.kind === "credit_card"
      ? [
          ["Entidad", debt.counterparty],
          [
            "Cupo",
            debt.credit_limit !== null
              ? formatCurrency(debt.credit_limit, currency)
              : null
          ],
          ["Tasa", rate ?? "Sin tasa"],
          [
            "Pago mínimo",
            debt.min_payment !== null
              ? formatCurrency(debt.min_payment, currency)
              : "Sin pago mínimo"
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
              debt.installment !== null
                ? formatCurrency(debt.installment, currency)
                : null
            ],
            ["Tasa", rate],
            [
              "Día de pago",
              debt.due_day !== null ? `Día ${debt.due_day}` : null
            ],
            [
              "Monto original",
              debt.original_amount !== null
                ? formatCurrency(debt.original_amount, currency)
                : null
            ],
            [
              "Plazo",
              debt.term_months !== null ? `${debt.term_months} meses` : null
            ]
          ]
        : [
            ["Deudor", debt.counterparty],
            ["Monto prestado", formatCurrency(debt.opening_balance, currency)],
            [
              "Fecha esperada",
              debt.expected_on !== null ? formatDate(debt.expected_on) : null
            ]
          ]

  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
      {rows
        .filter((row): row is [string, string] => row[1] !== null)
        .map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between gap-2 sm:flex-col sm:justify-start"
          >
            <dt className="text-muted">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
    </dl>
  )
}

/** Meses, mes de pago total e intereses, o el aviso que aplique */
function ProjectionDetails({
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
        <p className="text-sm text-muted">
          Agrega el pago mínimo para ver la proyección
        </p>
      )
    case "no_progress":
      return (
        <p className="text-sm font-medium text-(--expense)">
          Con este pago la deuda no baja
        </p>
      )
    case "too_long":
      return (
        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
          Más de 50 años
        </p>
      )
    case "ok":
      return (
        <div className="flex flex-col gap-2">
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div className="flex flex-col">
              <dt className="text-muted">Meses</dt>
              <dd className="font-medium tabular-nums">{projection.months}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-muted">Terminas en</dt>
              <dd className="font-medium">
                {formatMonthYear(projection.payoffMonth)}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-muted">Intereses</dt>
              <dd className="font-medium tabular-nums">
                {formatCurrency(projection.totalInterest, currency)}
              </dd>
            </div>
          </dl>
          {projection.withoutRate && (
            <p className="text-xs text-muted">
              Sin tasa, la proyección no incluye intereses
            </p>
          )}
        </div>
      )
  }
}

/** "Si pagaras X al mes": recalcula la proyección sin guardar nada */
function PaymentSimulator({
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
    <div className="flex flex-col gap-3 rounded-lg bg-default/50 p-3">
      <TextField
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={setValue}
        className="flex flex-col gap-2"
      >
        <Label>Si pagaras al mes</Label>
        <Input placeholder="0" />
      </TextField>
      {valid && (
        <ProjectionDetails
          projection={debtProjection(debt, payment)}
          currency={currency}
        />
      )}
    </div>
  )
}
