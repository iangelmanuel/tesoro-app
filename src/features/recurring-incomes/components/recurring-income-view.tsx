import { CalendarClock, CalendarPlus, CircleCheck, Plus } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { CardHeading } from "@/components/dashboard/card-heading"
import { CardEmpty, EmptyState } from "@/components/dashboard/empty-state"
import { MonthNav } from "@/components/dashboard/month-nav"
import { CARD, CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import { TONE_TEXT_CLASSES } from "@/components/dashboard/tone"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SITE } from "@/config/site"
import { getAccountBalances } from "@/features/accounts/queries"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import { getCategories } from "@/features/categories/queries"
import { OverdueIndicator } from "@/features/recurring-expenses/components/overdue-indicator"
import { UpcomingPaymentsCardSkeleton } from "@/features/recurring-expenses/components/upcoming-payments-card"
import { parseRecurringMonth } from "@/features/recurring-expenses/month"
import type { PersonalWorkspace } from "@/features/workspaces/queries"
import { cn } from "@/libs/cn"
import { todayISO } from "@/libs/dates"
import { groupIncomeRows } from "../month-rows"
import { incomeFrequencyLabel } from "../occurrences"
import {
  type RecurringIncome,
  getIncomeOverdueSummary,
  getIncomeSources,
  getRecurringIncomeStartMonth,
  getRecurringIncomes,
  getUpcomingIncomes
} from "../queries"
import { IncomeSheetProvider } from "./income-sheet-context"
import { ReceiveIncomeButton } from "./receive-income-button"
import { RecurringIncomeDialog } from "./recurring-income-dialog"
import {
  RecurringIncomesList,
  RecurringIncomesListSkeleton
} from "./recurring-incomes-list"
import { UpcomingIncomes } from "./upcoming-incomes"

/**
 * Contenido de Ingresos fijos: ingresos del mes elegido (`?month`), sin fecha
 * fija y lista. Misma estructura que Gastos fijos (SPEC 37).
 */
export async function RecurringIncomeView({
  workspace,
  month: monthParam
}: {
  workspace: PersonalWorkspace
  /** `?month` crudo; se acota entre el ingreso más antiguo y el mes actual */
  month: string | string[] | undefined
}) {
  // Se parsea tras leer la sesión: el mes por defecto usa new Date()
  const month = parseRecurringMonth(
    monthParam,
    await getRecurringIncomeStartMonth(workspace.id)
  )
  const [categories, incomes, upcoming, accounts, sources, overdue] =
    await Promise.all([
      getCategories(workspace.id),
      getRecurringIncomes(workspace.id),
      getUpcomingIncomes(workspace.id, month.month),
      getAccountBalances(workspace.id),
      getIncomeSources(workspace.id),
      getIncomeOverdueSummary(workspace.id)
    ])

  const createButton = (
    <RecurringIncomeDialog
      workspaceId={workspace.id}
      categories={categories}
      accounts={accounts}
      trigger={
        <Button>
          <Plus />
          Nuevo ingreso fijo
        </Button>
      }
    />
  )

  if (incomes.length === 0) {
    return (
      <EmptyState
        icon={CalendarPlus}
        title="Agrega tus ingresos fijos"
        description="Tu salario, un arriendo que recibes, un proyecto o una inversión. Tesoro te muestra qué ya te pagaron y qué falta."
      >
        {createButton}
      </EmptyState>
    )
  }

  // Las fuentes con calendario siguen en el navegador aunque estén pausadas:
  // sus meses pasados conservan lo recibido
  const hasSchedule = incomes.some((income) => income.frequency !== "none")
  const withoutDate = incomes.filter(
    (income) => income.frequency === "none" && income.is_active
  )
  const today = todayISO()
  const rows = groupIncomeRows(upcoming, month.month, today)
  const frequencyLabels = new Map(
    incomes.map((income) => [income.id, incomeFrequencyLabel(income)])
  )
  const isUpToDate = upcoming.every((income) => income.status === "received")
  // Resumen del mes elegido: en el mes actual no cuentan los pendientes que
  // vienen de meses anteriores. Un cobro de más no suma por encima de lo
  // esperado de su ocurrencia
  const monthIncomes = upcoming.filter((income) =>
    income.dueOn.startsWith(month.month)
  )
  const expected = sumCents(monthIncomes.map((income) => income.amount))
  const received = sumCents(
    monthIncomes.map((income) => Math.min(income.receivedAmount, income.amount))
  )

  return (
    <IncomeSheetProvider
      incomes={incomes}
      categories={categories}
      accounts={accounts}
      incomeSources={sources}
      currency={workspace.currency}
    >
      <div className="flex flex-wrap items-center gap-2">
        {createButton}
        {overdue.count > 0 && (
          <div className="md:ml-auto">
            <OverdueIndicator
              summary={overdue}
              currency={workspace.currency}
              path={SITE.routes.personalRecurringIncome}
            />
          </div>
        )}
      </div>

      {hasSchedule && (
        <section
          aria-label={
            month.isCurrent ? "Próximos ingresos" : `Ingresos de ${month.label}`
          }
          className={CARD}
        >
          <CardHeading
            title={
              month.isCurrent
                ? "Próximos ingresos"
                : `Ingresos de ${month.label}`
            }
            help="upcomingIncomes"
            control={
              <MonthNav
                path={SITE.routes.personalRecurringIncome}
                label={month.label}
                prev={month.prev}
                next={month.next}
                on="card"
              />
            }
          />
          <div className="flex flex-col gap-3">
            {monthIncomes.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Recibido{" "}
                <Amount
                  value={received}
                  currency={workspace.currency}
                  className="font-medium text-foreground"
                />{" "}
                de{" "}
                <Amount
                  value={expected}
                  currency={workspace.currency}
                />
              </p>
            )}
            {upcoming.length === 0 && !month.isCurrent && (
              <CardEmpty
                icon={CalendarClock}
                message="Sin ingresos en este mes"
                hint="Tus ingresos fijos no llegaban en este mes."
              />
            )}
            {isUpToDate && month.isCurrent && (
              <CardEmpty
                icon={CircleCheck}
                message="Ya recibiste todo lo de este mes"
              />
            )}
            {/* Los recibidos del mes siguen en la lista con su monto */}
            {rows.length > 0 && (
              <UpcomingIncomes
                rows={rows}
                currency={workspace.currency}
                frequencyLabels={frequencyLabels}
                renderAction={(income) => (
                  <ReceiveIncomeButton
                    workspaceId={workspace.id}
                    target={{
                      recurringIncomeId: income.recurringIncomeId,
                      name: income.name,
                      amount: income.amount,
                      categoryId: income.category.id,
                      accountId: income.accountId,
                      dueOn: income.dueOn
                    }}
                    categories={categories}
                    accounts={accounts}
                    incomeSources={sources}
                  />
                )}
              />
            )}
          </div>
        </section>
      )}

      {withoutDate.length > 0 && (
        <section
          aria-label="Sin fecha fija"
          className={CARD}
        >
          <CardHeading
            title="Sin fecha fija"
            help="noFixedDate"
          />
          <NoFixedDateList
            incomes={withoutDate}
            currency={workspace.currency}
          />
        </section>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Ingresos fijos</h2>
        <RecurringIncomesList
          incomes={incomes}
          categories={categories}
          accounts={accounts}
          currency={workspace.currency}
        />
      </div>
    </IncomeSheetProvider>
  )
}

const sumCents = (values: number[]) =>
  values.reduce((total, value) => total + Math.round(value * 100), 0) / 100

// Proyectos e inversiones: lo recibido en el mes y en el año, sin estados
function NoFixedDateList({
  incomes,
  currency
}: {
  incomes: RecurringIncome[]
  currency: string
}) {
  return (
    <ul className={CARD_LIST}>
      {incomes.map((income) => (
        <li
          key={income.id}
          className={cn(
            "flex flex-col gap-2 md:flex-row md:items-center md:gap-x-4",
            CARD_ROW
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="min-w-0 font-medium break-words">{income.name}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <CategoryBadge
                name={income.category.name}
                icon={income.category.icon}
                color={income.category.color}
              />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm md:text-end">
            <dt className="text-muted-foreground">Este mes</dt>
            <dt className="text-muted-foreground">Este año</dt>
            <dd className={cn("font-medium", TONE_TEXT_CLASSES.success)}>
              <Amount
                value={income.received?.month ?? 0}
                currency={currency}
              />
            </dd>
            <dd className="font-medium">
              <Amount
                value={income.received?.year ?? 0}
                currency={currency}
              />
            </dd>
          </dl>
        </li>
      ))}
    </ul>
  )
}

/**
 * Ingresos fijos mientras carga: botón de arriba, la tarjeta de ingresos del
 * mes (con su selector) y la tabla, con los mismos contenedores
 */
export function RecurringIncomeViewSkeleton() {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-11 w-48 rounded-4xl" />
      </div>
      <UpcomingPaymentsCardSkeleton withMonth />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-36" />
        <RecurringIncomesListSkeleton />
      </div>
    </>
  )
}
