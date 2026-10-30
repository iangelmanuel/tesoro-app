"use client"

import { useState } from "react"
import { Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet"
import type { AccountOption } from "@/features/accounts/components/account-select"
import { parseAmount } from "@/features/transactions/schemas"
import { formatCurrency, formatDate } from "@/libs/format"
import {
  type DebtProjection,
  debtProjection,
  debtStatusLabel,
  formatMonthYear,
  formatRate,
  isActiveDebt,
  isReceivableOverdue
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
  accounts?: AccountOption[]
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
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="truncate">{debt.name}</SheetTitle>
            {status && <ToneBadge tone={status.tone}>{status.label}</ToneBadge>}
            {isReceivableOverdue(debt, today) && (
              <ToneBadge tone="warning">Vencida</ToneBadge>
            )}
          </div>
          <SheetDescription className="tabular-nums">
            Saldo{" "}
            <span className="font-medium text-foreground">
              {formatCurrency(debt.balance, currency)}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-4">
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
          </div>

          {isActiveDebt(debt) && debt.balance > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase">
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
                  <Button disabled={debt.balance <= 0}>
                    <Plus data-icon="inline-start" />
                    {isReceivable ? "Registrar abono" : "Registrar pago"}
                  </Button>
                }
              />
              <AdjustBalanceDialog
                debt={debt}
                currency={currency}
                trigger={
                  <Button variant="outline">
                    <RefreshCw data-icon="inline-start" />
                    Actualizar saldo
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3">
              <p className="text-sm text-muted-foreground">
                {status?.label}. Reactívala para registrar{" "}
                {isReceivable ? "abonos" : "pagos"}.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => run("reactivate")}
              >
                Reactivar
              </Button>
            </div>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase">
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
      </SheetContent>
    </Sheet>
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
            <dt className="text-muted-foreground">{label}</dt>
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
        <p className="text-sm text-muted-foreground">
          Agrega el pago mínimo para ver la proyección
        </p>
      )
    case "no_progress":
      return (
        <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
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
              <dt className="text-muted-foreground">Meses</dt>
              <dd className="font-medium tabular-nums">{projection.months}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-muted-foreground">Terminas en</dt>
              <dd className="font-medium">
                {formatMonthYear(projection.payoffMonth)}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-muted-foreground">Intereses</dt>
              <dd className="font-medium tabular-nums">
                {formatCurrency(projection.totalInterest, currency)}
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
    <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3">
      <Label htmlFor={`simulator-${debt.id}`}>Si pagaras al mes</Label>
      <Input
        id={`simulator-${debt.id}`}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {valid && (
        <ProjectionDetails
          projection={debtProjection(debt, payment)}
          currency={currency}
        />
      )}
    </div>
  )
}
