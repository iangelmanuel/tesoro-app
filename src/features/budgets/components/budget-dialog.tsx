"use client"

import { useActionState, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { upsertBudget } from "../actions"
import { type BudgetMonth, monthStart } from "../month"
import type { BudgetProgress } from "../queries"
import type { BudgetFormState } from "../types"

const AMOUNT_FORMAT = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2
})

interface BudgetDialogProps {
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
  /** Botón que abre el diálogo */
  trigger: React.ReactNode
}

export function BudgetDialog({
  month,
  categories,
  budget,
  defaultCategoryId,
  trigger
}: BudgetDialogProps) {
  const [open, setOpen] = useState(false)
  const isEditing = budget !== undefined

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar presupuesto" : "Nuevo presupuesto"}
          </DialogTitle>
          <DialogDescription>
            Cuánto quieres gastar como máximo en{" "}
            <span className="capitalize">{month.label}</span>.
          </DialogDescription>
        </DialogHeader>
        {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
        <BudgetForm
          month={month}
          categories={categories}
          budget={budget}
          defaultCategoryId={defaultCategoryId}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

interface BudgetFormProps {
  month: BudgetMonth
  categories: Category[]
  budget?: BudgetProgress
  defaultCategoryId?: string
  onSaved: () => void
  onCancel: () => void
}

function BudgetForm({
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

      <Field
        id="category_id"
        label="Categoría"
        errors={errors?.category_id}
      >
        {isEditing ? (
          <>
            <input
              type="hidden"
              name="category_id"
              value={budget.categoryId}
            />
            <div>
              <CategoryBadge
                name={budget.name}
                icon={budget.icon}
                color={budget.color}
              />
            </div>
          </>
        ) : (
          <Select
            name="category_id"
            value={categoryId}
            onValueChange={setCategoryId}
          >
            <SelectTrigger
              id="category_id"
              className="w-full"
              aria-invalid={Boolean(errors?.category_id) || undefined}
            >
              <SelectValue placeholder="Elige una categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem
                  key={category.id}
                  value={category.id}
                >
                  <CategoryBadge
                    name={category.name}
                    icon={category.icon}
                    color={category.color}
                  />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!isEditing && categories.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Todas tus categorías de gasto ya tienen presupuesto este mes.
          </p>
        )}
      </Field>

      <Field
        id="amount"
        label="Monto"
        errors={errors?.amount}
      >
        <Input
          id="amount"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          defaultValue={
            values?.amount ??
            (budget?.budgetAmount
              ? AMOUNT_FORMAT.format(budget.budgetAmount)
              : "")
          }
          aria-invalid={Boolean(errors?.amount) || undefined}
          required
        />
      </Field>

      {state.error && (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {state.error}
        </p>
      )}

      <DialogFooter>
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
      </DialogFooter>
    </form>
  )
}

function Field({
  id,
  label,
  errors,
  children
}: {
  id: string
  label: string
  errors?: string[]
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {errors?.length ? (
        <p className="text-sm text-destructive">{errors[0]}</p>
      ) : null}
    </div>
  )
}
