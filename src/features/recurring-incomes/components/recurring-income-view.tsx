import { Button, Card, CardContent, cn } from "@heroui/react"
import { CalendarPlus, CircleCheck, Plus } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { CardHeading } from "@/components/dashboard/card-heading"
import { CardEmpty, EmptyState } from "@/components/dashboard/empty-state"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import { getAccountBalances } from "@/features/accounts/queries"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import { getCategories } from "@/features/categories/queries"
import type { PersonalWorkspace } from "@/features/workspaces/queries"
import {
  type RecurringIncome,
  getIncomeSources,
  getRecurringIncomes,
  getUpcomingIncomes
} from "../queries"
import { ReceiveIncomeButton } from "./receive-income-button"
import { RecurringIncomeDialog } from "./recurring-income-dialog"
import { RecurringIncomesList } from "./recurring-incomes-list"
import { UpcomingIncomes } from "./upcoming-incomes"

/** Contenido de Ingresos fijos: próximos ingresos, sin fecha fija y lista */
export async function RecurringIncomeView({
  workspace
}: {
  workspace: PersonalWorkspace
}) {
  const [categories, incomes, upcoming, accounts, sources] = await Promise.all([
    getCategories(workspace.id),
    getRecurringIncomes(workspace.id),
    getUpcomingIncomes(workspace.id),
    getAccountBalances(workspace.id),
    getIncomeSources(workspace.id)
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

  const scheduled = incomes.filter(
    (income) => income.frequency !== "none" && income.is_active
  )
  const withoutDate = incomes.filter(
    (income) => income.frequency === "none" && income.is_active
  )
  const isUpToDate = upcoming.every((income) => income.transactionId !== null)
  // "Marcar recibido" solo en la ocurrencia no recibida más antigua de cada
  // ingreso fijo: es la que el servidor enlaza al guardar. La lista viene en
  // orden de vencimiento
  const receivable = new Set<string>()
  const seen = new Set<string>()
  for (const income of upcoming) {
    if (income.transactionId === null && !seen.has(income.recurringIncomeId)) {
      seen.add(income.recurringIncomeId)
      receivable.add(`${income.recurringIncomeId}-${income.dueOn}`)
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">{createButton}</div>

      {scheduled.length > 0 && (
        <Card>
          <CardHeading
            title="Próximos ingresos"
            help="upcomingIncomes"
          />
          <CardContent className="flex flex-col gap-3">
            {isUpToDate && (
              <CardEmpty
                icon={CircleCheck}
                message="Ya recibiste todo lo de este mes"
              />
            )}
            {/* Los recibidos del mes siguen en la lista con su monto */}
            {upcoming.length > 0 && (
              <UpcomingIncomes
                incomes={upcoming}
                currency={workspace.currency}
                renderAction={(income) =>
                  receivable.has(
                    `${income.recurringIncomeId}-${income.dueOn}`
                  ) ? (
                    <ReceiveIncomeButton
                      workspaceId={workspace.id}
                      income={income}
                      categories={categories}
                      accounts={accounts}
                      incomeSources={sources}
                    />
                  ) : null
                }
              />
            )}
          </CardContent>
        </Card>
      )}

      {withoutDate.length > 0 && (
        <Card>
          <CardHeading
            title="Sin fecha fija"
            help="noFixedDate"
          />
          <CardContent>
            <NoFixedDateList
              incomes={withoutDate}
              currency={workspace.currency}
            />
          </CardContent>
        </Card>
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
    </>
  )
}

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
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <CategoryBadge
                name={income.category.name}
                icon={income.category.icon}
                color={income.category.color}
              />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm md:text-end">
            <dt className="text-muted">Este mes</dt>
            <dt className="text-muted">Este año</dt>
            <dd className="font-medium text-(--income)">
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
