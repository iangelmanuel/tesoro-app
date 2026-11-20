"use client"

import { useActionState, useState } from "react"
import { amountInput } from "@/components/forms/amount-format"
import { CategorySelectField } from "@/components/forms/category-select-field"
import { FieldLabel } from "@/components/forms/field-label"
import { FormDialog } from "@/components/forms/form-dialog"
import { TextInputField } from "@/components/forms/text-input-field"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { toast } from "@/components/ui/sonner"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { upsertBudget } from "../actions"
import { type BudgetMonth, monthStart } from "../month"
import type { BudgetProgress } from "../queries"
import type { BudgetFormState } from "../types"

interface BudgetDialogProps {
  /** Espacio del presupuesto (para crear una categoría desde el select) */
  workspaceId: string
  month: BudgetMonth
  /**
   * Categorías que se pueden presupuestar: de gasto, activas y sin
   * presupuesto en el mes
   */
  categories: Category[]
  /** Si llega, el diálogo edita este presupuesto (la categoría no cambia) */
  budget?: BudgetProgress
  /** Categoría preseleccionada al crear (desde "Sin presupuesto") */
  defaultCategoryId?: string
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function BudgetDialog({
  workspaceId,
  month,
  categories,
  budget,
  defaultCategoryId,
  trigger,
  open: controlledOpen,
  onOpenChange
}: BudgetDialogProps) {
  const isEditing = budget !== undefined

  return (
    <FormDialog
      trigger={trigger}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      className="sm:max-w-md"
      title={isEditing ? "Editar presupuesto" : "Nuevo presupuesto"}
      description={
        <>
          Cuánto quieres gastar como máximo en{" "}
          <span className="capitalize">{month.label}</span>.
        </>
      }
    >
      {(close) => (
        <BudgetForm
          workspaceId={workspaceId}
          month={month}
          categories={categories}
          budget={budget}
          defaultCategoryId={defaultCategoryId}
          onSaved={close}
          onCancel={close}
        />
      )}
    </FormDialog>
  )
}

interface BudgetFormProps {
  workspaceId: string
  month: BudgetMonth
  categories: Category[]
  budget?: BudgetProgress
  defaultCategoryId?: string
  onSaved: () => void
  onCancel: () => void
}

function BudgetForm({
  workspaceId,
  month,
  categories,
  budget,
  defaultCategoryId,
  onSaved,
  onCancel
}: BudgetFormProps) {
  const isEditing = budget !== undefined
  const [categoryId, setCategoryId] = useState(
    budget?.categoryId ?? defaultCategoryId ?? ""
  )

  const [state, formAction, pending] = useActionState<
    BudgetFormState,
    FormData
  >(async (prevState, formData) => {
    const result = await upsertBudget(prevState, formData)

    if (result.ok) {
      toast.success(
        isEditing ? "Presupuesto actualizado" : "Presupuesto creado"
      )
      onSaved()
    }
    return result
  }, {})

  const errors = state.fieldErrors
  const values = state.values
  const categoryError = errors?.category_id?.[0]

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      <input
        type="hidden"
        name="month"
        value={monthStart(month.month)}
      />

      {isEditing ? (
        // La categoría no cambia al editar: se muestra, no se elige
        <div
          className="flex flex-col gap-2"
          data-invalid={categoryError ? true : undefined}
        >
          <input
            type="hidden"
            name="category_id"
            value={budget.categoryId}
          />
          <FieldLabel
            help="budget.category"
            isInvalid={Boolean(categoryError)}
          >
            Categoría
          </FieldLabel>
          <div>
            <CategoryBadge
              name={budget.name}
              icon={budget.icon}
              color={budget.color}
            />
          </div>
          {categoryError ? <FieldError>{categoryError}</FieldError> : null}
        </div>
      ) : (
        <CategorySelectField
          name="category_id"
          value={categoryId}
          onChange={setCategoryId}
          categories={categories}
          workspaceId={workspaceId}
          type="expense"
          help="budget.category"
          error={errors?.category_id?.[0]}
        >
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Todas tus categorías de salida ya tienen presupuesto este mes.
              Puedes crear una nueva.
            </p>
          )}
        </CategorySelectField>
      )}

      <TextInputField
        name="amount"
        label="Monto"
        help="budget.amount"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        defaultValue={
          values?.amount ??
          (budget?.budgetAmount ? amountInput(budget.budgetAmount) : "")
        }
        isRequired
        error={errors?.amount?.[0]}
      />

      {state.error && (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={pending}
        >
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Crear"}
        </Button>
      </div>
    </form>
  )
}
