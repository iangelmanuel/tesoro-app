"use client"

import { useTransition } from "react"
import { AlertDialog, Button, Chip, cn, toast } from "@heroui/react"
import { Pencil, Trash2 } from "lucide-react"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import { formatCurrency } from "@/libs/format"
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
  warning: "bg-amber-500",
  exceeded: "bg-rose-500"
}

export const STATUS_BADGE_CLASSES: Record<BudgetStatus, string> = {
  ok: "",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  exceeded: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
}

// Rayas para el segmento comprometido (pagos pendientes)
const STRIPES =
  "bg-[repeating-linear-gradient(135deg,var(--color-muted)_0_4px,transparent_4px_8px)] opacity-50"

interface BudgetProgressBarProps {
  spent: number
  committed: number
  budget: number
}

/** Barra con el gastado sólido y el comprometido rayado */
export function BudgetProgressBar({
  spent,
  committed,
  budget
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
      className="flex h-2 w-full overflow-hidden rounded-full bg-default"
    >
      <div
        className={cn("h-full transition-all", STATUS_BAR_CLASSES[status])}
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
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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
        <p className="ml-auto text-sm text-muted tabular-nums">
          <span className="font-medium text-foreground">
            {formatCurrency(budget.spent, currency)}
          </span>{" "}
          de {formatCurrency(budget.budgetAmount, currency)}
        </p>
        <div className="flex gap-1">
          <BudgetDialog
            month={month}
            categories={[]}
            budget={budget}
            trigger={
              <Button
                variant="ghost"
                isIconOnly
                size="sm"
                aria-label={`Editar presupuesto de ${budget.name}`}
              >
                <Pencil />
              </Button>
            }
          />
          <DeleteBudgetButton budget={budget} />
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
            status === "warning" && "text-amber-600 dark:text-amber-400",
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

function DeleteBudgetButton({
  budget
}: {
  budget: BudgetProgress & { budgetId: string }
}) {
  const [pending, startTransition] = useTransition()

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
    <AlertDialog>
      <Button
        variant="ghost"
        isIconOnly
        size="sm"
        aria-label={`Eliminar presupuesto de ${budget.name}`}
        isDisabled={pending}
      >
        <Trash2 />
      </Button>
      <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-md">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>
                ¿Eliminar este presupuesto?
              </AlertDialog.Heading>
              <AlertDialog.Body>
                <p className="text-sm text-muted">
                  Se eliminará el presupuesto de &ldquo;{budget.name}&rdquo; de
                  este mes. Tus movimientos no cambian.
                </p>
              </AlertDialog.Body>
            </AlertDialog.Header>
            <AlertDialog.Footer>
              <Button
                slot="close"
                variant="tertiary"
              >
                Cancelar
              </Button>
              <Button
                slot="close"
                variant="danger"
                onPress={handleDelete}
              >
                Eliminar
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
