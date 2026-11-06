"use client"

import { useState, useTransition } from "react"
import { Chip, Table, cn, toast } from "@heroui/react"
import { Pause, Pencil, Play, Trash2 } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { DeleteDialog } from "@/components/dashboard/delete-dialog"
import { RowActions } from "@/components/dashboard/row-actions"
import { ScrollTable } from "@/components/dashboard/scroll-table"
import type { AccountOption } from "@/features/accounts/components/account-select"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { formatDate } from "@/libs/format"
import { deleteRecurringIncome, toggleRecurringIncome } from "../actions"
import { incomeFrequencyLabel } from "../occurrences"
import type { RecurringIncome } from "../queries"
import { RecurringIncomeDialog } from "./recurring-income-dialog"

const NOWRAP = "whitespace-nowrap"

function validityLabel(income: RecurringIncome) {
  const from = formatDate(income.starts_on)
  return income.ends_on
    ? `${from} – ${formatDate(income.ends_on)}`
    : `Desde ${from}`
}

interface RecurringIncomesListProps {
  incomes: RecurringIncome[]
  categories: Category[]
  accounts: AccountOption[]
  currency: string
}

// Client: cada fila abre el diálogo de edición, y así las categorías y
// cuentas viajan una sola vez en vez de una por fila
export function RecurringIncomesList({
  incomes,
  categories,
  accounts,
  currency
}: RecurringIncomesListProps) {
  return (
    <ScrollTable minWidth="60rem">
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Ingresos fijos">
            <Table.Header>
              <Table.Column isRowHeader>Nombre</Table.Column>
              <Table.Column className={NOWRAP}>Categoría</Table.Column>
              <Table.Column className={cn("text-end", NOWRAP)}>
                Monto esperado
              </Table.Column>
              <Table.Column className={NOWRAP}>Frecuencia</Table.Column>
              <Table.Column className={NOWRAP}>Cuenta</Table.Column>
              <Table.Column className={NOWRAP}>Vigencia</Table.Column>
              <Table.Column className={NOWRAP}>Estado</Table.Column>
              <Table.Column className="w-28 md:w-16">
                <span className="sr-only">Acciones</span>
              </Table.Column>
            </Table.Header>
            <Table.Body>
              {incomes.map((income) => (
                <Table.Row
                  key={income.id}
                  className={cn(!income.is_active && "text-muted")}
                >
                  <Table.Cell className="max-w-64 min-w-44">
                    <p
                      title={income.name}
                      className="line-clamp-3 font-medium break-words"
                    >
                      {income.name}
                    </p>
                  </Table.Cell>
                  <Table.Cell className={NOWRAP}>
                    <CategoryBadge
                      name={
                        income.category.archived_at
                          ? `${income.category.name} (archivada)`
                          : income.category.name
                      }
                      icon={income.category.icon}
                      color={income.category.color}
                    />
                  </Table.Cell>
                  <Table.Cell className={cn("text-end font-medium", NOWRAP)}>
                    <Amount
                      value={income.amount}
                      currency={currency}
                    />
                  </Table.Cell>
                  <Table.Cell className={NOWRAP}>
                    {incomeFrequencyLabel(income)}
                  </Table.Cell>
                  <Table.Cell className={cn("text-muted", NOWRAP)}>
                    {income.accountName ?? "Sin cuenta"}
                  </Table.Cell>
                  <Table.Cell className={cn("text-muted", NOWRAP)}>
                    {validityLabel(income)}
                  </Table.Cell>
                  <Table.Cell className={NOWRAP}>
                    {income.is_active ? (
                      <Chip size="sm">Activo</Chip>
                    ) : (
                      <Chip
                        size="sm"
                        variant="tertiary"
                      >
                        Pausado
                      </Chip>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <IncomeActions
                      income={income}
                      categories={categories}
                      accounts={accounts}
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </ScrollTable>
  )
}

// Editar, pausar o reanudar y eliminar. Los diálogos se controlan desde aquí
// porque el menú de escritorio no puede alojar sus triggers
function IncomeActions({
  income,
  categories,
  accounts
}: {
  income: RecurringIncome
  categories: Category[]
  accounts: AccountOption[]
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleRecurringIncome(income.id, !income.is_active)
      if (result.error) {
        toast.danger(result.error)
      } else {
        toast.success(
          income.is_active ? "Ingreso fijo pausado" : "Ingreso fijo reanudado"
        )
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRecurringIncome(income.id)
      if (result.error) {
        toast.danger(result.error)
      } else {
        toast.success("Ingreso fijo eliminado")
      }
    })
  }

  return (
    <>
      <RowActions
        label={income.name}
        actions={[
          {
            id: "edit",
            label: "Editar",
            icon: <Pencil className="size-4" />,
            onAction: () => setEditing(true)
          },
          {
            id: "toggle",
            label: income.is_active ? "Pausar" : "Reanudar",
            icon: income.is_active ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            ),
            onAction: handleToggle
          },
          {
            id: "delete",
            label: "Eliminar",
            icon: <Trash2 className="size-4" />,
            destructive: true,
            onAction: () => setDeleting(true)
          }
        ]}
      />
      <RecurringIncomeDialog
        workspaceId={income.workspace_id}
        categories={categories}
        accounts={accounts}
        income={income}
        open={editing}
        onOpenChange={setEditing}
      />
      <DeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="¿Eliminar este ingreso fijo?"
        onConfirm={handleDelete}
      >
        <p className="text-sm text-muted">
          &ldquo;{income.name}&rdquo; dejará de aparecer en tus próximos
          ingresos y en el registro de ingresos. Los movimientos que ya
          registraste se conservan en Movimientos.
        </p>
      </DeleteDialog>
    </>
  )
}
