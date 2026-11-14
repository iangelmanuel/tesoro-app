import { Chip, cn } from "@heroui/react"
import { Amount } from "@/components/dashboard/amount"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import { TONE_BADGE_CLASSES as TONE_BADGE } from "@/components/dashboard/tone"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import { formatDate } from "@/libs/format"
import type { IncomeMonthRow, IncomeSummaryRow } from "../month-rows"
import {
  INCOME_OCCURRENCE_STATUS,
  type IncomeOccurrenceStatus,
  type IncomeOccurrenceTone
} from "../occurrences"
import type { UpcomingIncome } from "../queries"

const TONE_CLASSES: Record<IncomeOccurrenceTone, string> = {
  success: TONE_BADGE.success,
  danger: TONE_BADGE.danger,
  warning: TONE_BADGE.warning,
  neutral: "bg-default text-muted"
}

export function IncomeStatusBadge({
  status
}: {
  status: IncomeOccurrenceStatus
}) {
  const { label, tone } = INCOME_OCCURRENCE_STATUS[status]
  return (
    <Chip
      size="sm"
      className={TONE_CLASSES[tone]}
      color="accent"
      variant="primary"
    >
      {label}
    </Chip>
  )
}

/**
 * Monto de la fila: lo recibido (verde) si ya se cubrió; si no, lo que falta
 * (rojo si está atrasado)
 */
function RowAmount({
  status,
  received,
  remaining,
  currency,
  className
}: {
  status: IncomeOccurrenceStatus
  received: number
  remaining: number
  currency: string
  className?: string
}) {
  const isReceived = status === "received"
  return (
    <p
      className={cn(
        "shrink-0 font-medium whitespace-nowrap",
        isReceived && "text-(--income)",
        status === "overdue" && "text-(--expense)",
        className
      )}
    >
      <Amount
        value={isReceived ? received : remaining}
        currency={currency}
      />
    </p>
  )
}

/** "Recibió $ 20.000 de $ 50.000 · Falta $ 30.000" */
export function PartialDetail({
  received,
  expected,
  remaining,
  currency
}: {
  received: number
  expected: number
  remaining: number
  currency: string
}) {
  return (
    <span className="tabular-nums">
      Recibió{" "}
      <Amount
        value={received}
        currency={currency}
      />{" "}
      de{" "}
      <Amount
        value={expected}
        currency={currency}
      />{" "}
      · Falta{" "}
      <Amount
        value={remaining}
        currency={currency}
      />
    </span>
  )
}

interface RowLayoutProps {
  name: string
  status: IncomeOccurrenceStatus
  amount: React.ReactNode
  meta: React.ReactNode
  action: React.ReactNode
}

// Nombre, estado y monto arriba; detalle abajo; la acción a la derecha en
// escritorio y debajo a lo ancho en el teléfono
function RowLayout({ name, status, amount, meta, action }: RowLayoutProps) {
  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="min-w-0 font-medium break-words">{name}</p>
            <IncomeStatusBadge status={status} />
          </div>
          {/* < 768 px: el monto va junto al nombre */}
          <div className="md:hidden">{amount}</div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          {meta}
        </div>
      </div>
      <div className="contents md:flex md:items-center md:gap-3">
        <div className="max-md:hidden">{amount}</div>
        {action}
      </div>
    </>
  )
}

function OccurrenceRow({
  income,
  currency,
  action
}: {
  income: UpcomingIncome
  currency: string
  action: React.ReactNode
}) {
  return (
    <RowLayout
      name={income.name}
      status={income.status}
      amount={
        <RowAmount
          status={income.status}
          received={income.receivedAmount}
          remaining={income.remaining}
          currency={currency}
        />
      }
      meta={
        <>
          <span className="whitespace-nowrap">{formatDate(income.dueOn)}</span>
          {income.status === "partial" && (
            <PartialDetail
              received={income.receivedAmount}
              expected={income.amount}
              remaining={income.remaining}
              currency={currency}
            />
          )}
          <CategoryBadge
            name={income.category.name}
            icon={income.category.icon}
            color={income.category.color}
          />
        </>
      }
      action={action}
    />
  )
}

/** "Diario · 18 de 30 días" o "Cada 14 días · 1 de 2" */
function summaryProgress(row: IncomeSummaryRow, label: string) {
  const unit = row.first.frequency === "daily" ? " días" : ""
  const progress = `${label} · ${row.receivedCount} de ${row.monthCount}${unit}`
  if (row.carriedCount === 0) {
    return progress
  }
  const carried = `${row.carriedCount} ${row.carriedCount === 1 ? "pendiente" : "pendientes"} de meses anteriores`
  return `${progress} · ${carried}`
}

function SummaryRow({
  row,
  label,
  currency,
  action
}: {
  row: IncomeSummaryRow
  label: string
  currency: string
  action: React.ReactNode
}) {
  return (
    <RowLayout
      name={row.first.name}
      status={row.status}
      amount={
        <RowAmount
          status={row.status}
          received={row.received}
          remaining={row.remaining}
          currency={currency}
        />
      }
      meta={
        <>
          <span>{summaryProgress(row, label)}</span>
          {row.remaining > 0 && (
            <span className="tabular-nums">
              Falta{" "}
              <Amount
                value={row.remaining}
                currency={currency}
              />
            </span>
          )}
          <CategoryBadge
            name={row.first.category.name}
            icon={row.first.category.icon}
            color={row.first.category.color}
          />
        </>
      }
      action={action}
    />
  )
}

interface UpcomingIncomesProps {
  rows: IncomeMonthRow[]
  currency: string
  /** Frecuencia de cada ingreso fijo ("Diario", "Cada 14 días") por id */
  frequencyLabels: Map<string, string>
  /**
   * **Recibir** de una ocurrencia sin recibir completa. En una fila resumen
   * llega con `dueOn` = la ocurrencia hasta la que se prellena
   */
  renderAction?: (income: UpcomingIncome) => React.ReactNode
}

export function UpcomingIncomes({
  rows,
  currency,
  frequencyLabels,
  renderAction
}: UpcomingIncomesProps) {
  return (
    <ul className={CARD_LIST}>
      {rows.map((row) => {
        const rowClass = cn(
          "flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-x-4",
          CARD_ROW
        )

        if (row.kind === "occurrence") {
          const { income } = row
          return (
            <li
              key={`${income.recurringIncomeId}-${income.dueOn}`}
              className={rowClass}
            >
              <OccurrenceRow
                income={income}
                currency={currency}
                action={income.status !== "received" && renderAction?.(income)}
              />
            </li>
          )
        }

        return (
          <li
            key={`summary-${row.recurringIncomeId}`}
            className={rowClass}
          >
            <SummaryRow
              row={row}
              label={frequencyLabels.get(row.recurringIncomeId) ?? ""}
              currency={currency}
              action={
                row.receiveDueOn !== null &&
                renderAction?.({ ...row.first, dueOn: row.receiveDueOn })
              }
            />
          </li>
        )
      })}
    </ul>
  )
}
