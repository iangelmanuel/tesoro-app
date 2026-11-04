"use client"

import { useState, useTransition } from "react"
import { Chip, cn, toast } from "@heroui/react"
import { Pencil, Trash2 } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { DeleteDialog } from "@/components/dashboard/delete-dialog"
import { RowActions } from "@/components/dashboard/row-actions"
import { SURFACE_ROW } from "@/components/dashboard/surface"
import {
  TONE_BADGE_CLASSES as TONE_BADGE,
  TONE_BAR_CLASSES as TONE_BAR,
  TONE_TEXT_CLASSES as TONE_TEXT
} from "@/components/dashboard/tone"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import { deleteBudget } from "../actions"
import type { BudgetMonth } from "../month"
import {
  BUDGET_STATUS_LABELS,
  type BudgetStatus,
  budgetPercent,
  budgetStatus,
  formatPercent,
  projectedPercent
} from "../progress"
import type { BudgetProgress } from "../queries"
import { BudgetDialog } from "./budget-dialog"

export const STATUS_BAR_CLASSES: Record<BudgetStatus, string> = {
  ok: "bg-accent",
  warning: TONE_BAR.warning,
  exceeded: TONE_BAR.danger
}

export const STATUS_BADGE_CLASSES: Record<BudgetStatus, string> = {
  ok: "",
  warning: TONE_BADGE.warning,
  exceeded: TONE_BADGE.danger
}

// Rayas para el segmento comprometido (pagos pendientes)
const STRIPES =
  "bg-[repeating-linear-gradient(135deg,var(--color-muted)_0_4px,transparent_4px_8px)] opacity-50"

interface BudgetProgressBarProps {
  spent: number
  committed: number
  budget: number
  /** Nombre accesible de la barra ("Mercado: 85 %") */
  label?: string
}

/** Barra con el gastado sólido y el comprometido rayado */
export function BudgetProgressBar({
  spent,
  committed,
  budget,
  label
}: BudgetProgressBarProps) {
  const status = budgetStatus(spent, budget)
  const spentWidth = Math.min((spent / budget) * 100, 100)
  const committedWidth = Math.min((committed / budget) * 100, 100 - spentWidth)

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(budgetPercent(spent, budget), 100)}
      aria-label={label}
      className="flex h-2 w-full overflow-hidden rounded-full bg-default"
    >
      <div
        className={cn(
          "h-full transition-all motion-reduce:transition-none",
          STATUS_BAR_CLASSES[status]
        )}
        style={{ width: `${spentWidth}%` }}
      />
      {committedWidth > 0 && (
        <div
          className={cn("h-full", STRIPES)}
          style={{ width: `${committedWidth}%` }}
        />
      )}
    </div>
  )
}

interface BudgetProgressRowProps {
  /** Fila con presupuesto (budgetAmount no es null) */
  budget: BudgetProgress & { budgetId: string; budgetAmount: number }
  month: BudgetMonth
  currency: string
}

export function BudgetProgressRow({
  budget,
  month,
  currency
}: BudgetProgressRowProps) {
  const status = budgetStatus(budget.spent, budget.budgetAmount)
  const statusLabel = BUDGET_STATUS_LABELS[status]
  const percent = budgetPercent(budget.spent, budget.budgetAmount)
  const projected = projectedPercent(
    budget.spent,
    budget.committed,
    budget.budgetAmount
  )

  return (
    <li className={`flex flex-col gap-3 ${SURFACE_ROW}`}>
      {/* Misma grilla que "Sin presupuesto": categoría | monto | acciones.
          En el teléfono el monto baja a una segunda línea */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <CategoryBadge
            name={budget.archived ? `${budget.name} (archivada)` : budget.name}
            icon={budget.icon}
            color={budget.color}
          />
          {statusLabel && (
            <Chip
              size="sm"
              className={STATUS_BADGE_CLASSES[status]}
              color="accent"
              variant="primary"
            >
              {statusLabel}
            </Chip>
          )}
        </div>
        <p className="col-span-2 row-start-2 text-sm whitespace-nowrap text-muted tabular-nums md:col-span-1 md:col-start-2 md:row-start-1 md:text-right">
          <span className="font-medium text-foreground">
            <Amount
              value={budget.spent}
              currency={currency}
            />
          </span>{" "}
          de{" "}
          <Amount
            value={budget.budgetAmount}
            currency={currency}
          />
        </p>
        <div className="col-start-2 row-start-1 md:col-start-3">
          <BudgetActions
            budget={budget}
            month={month}
          />
        </div>
      </div>
      <BudgetProgressBar
        spent={budget.spent}
        committed={budget.committed}
        budget={budget.budgetAmount}
      />
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <span
          className={cn(
            "font-medium tabular-nums",
            status === "warning" && TONE_TEXT.warning,
            status === "exceeded" && "text-(--expense)"
          )}
        >
          {formatPercent(percent)}
        </span>
        {projected !== null && (
          <span className="text-muted">
            Con pagos pendientes llegarías al {formatPercent(projected)}
          </span>
        )}
      </div>
    </li>
  )
}

function BudgetActions({
  budget,
  month
}: {
  budget: BudgetProgress & { budgetId: string }
  month: BudgetMonth
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteBudget(budget.budgetId)
      if (result.error) {
        toast.danger(result.error)
      } else {
        toast.success("Presupuesto eliminado")
      }
    })
  }

  return (
    <>
      <RowActions
        label={`presupuesto de ${budget.name}`}
        actions={[
          {
            id: "edit",
            label: "Editar",
            icon: <Pencil className="size-4" />,
            onAction: () => setEditing(true)
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
      <BudgetDialog
        month={month}
        categories={[]}
        budget={budget}
        open={editing}
        onOpenChange={setEditing}
      />
      <DeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="¿Eliminar este presupuesto?"
        onConfirm={handleDelete}
      >
        <p className="text-sm text-muted">
          Se eliminará el presupuesto de &ldquo;{budget.name}&rdquo; de este
          mes. Tus movimientos no cambian.
        </p>
      </DeleteDialog>
    </>
  )
}
