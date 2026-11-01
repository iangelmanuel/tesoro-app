"use client"

import { useActionState, useState } from "react"
import {
  Button,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
  toast
} from "@heroui/react"
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
    <Modal>
      {trigger}
      <Modal.Backdrop
        isOpen={open}
        onOpenChange={setOpen}
      >
        <Modal.Container scroll="outside">
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {isEditing ? "Editar presupuesto" : "Nuevo presupuesto"}
              </Modal.Heading>
              <p className="text-sm text-muted">
                Cuánto quieres gastar como máximo en{" "}
                <span className="capitalize">{month.label}</span>.
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              <BudgetForm
                month={month}
                categories={categories}
                budget={budget}
                defaultCategoryId={defaultCategoryId}
                onSaved={() => setOpen(false)}
                onCancel={() => setOpen(false)}
              />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
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

      {isEditing ? (
        <Field
          id="category_id"
          label="Categoría"
          errors={errors?.category_id}
        >
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
        </Field>
      ) : (
        <Select
          name="category_id"
          fullWidth
          placeholder="Elige una categoría"
          value={categoryId || null}
          onChange={(key) => setCategoryId(key == null ? "" : String(key))}
          isInvalid={Boolean(errors?.category_id)}
          className="flex flex-col gap-2"
        >
          <Label>Categoría</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {categories.map((category) => (
                <ListBox.Item
                  key={category.id}
                  id={category.id}
                  textValue={category.name}
                >
                  <CategoryBadge
                    name={category.name}
                    icon={category.icon}
                    color={category.color}
                  />
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
          <FieldError>{errors?.category_id?.[0]}</FieldError>
          {categories.length === 0 && (
            <p className="text-sm text-muted">
              Todas tus categorías de gasto ya tienen presupuesto este mes.
            </p>
          )}
        </Select>
      )}

      <TextField
        name="amount"
        inputMode="decimal"
        autoComplete="off"
        defaultValue={
          values?.amount ??
          (budget?.budgetAmount
            ? AMOUNT_FORMAT.format(budget.budgetAmount)
            : "")
        }
        isRequired
        isInvalid={Boolean(errors?.amount)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Monto</Label>
        <Input placeholder="0" />
        <FieldError>{errors?.amount?.[0]}</FieldError>
      </TextField>

      {state.error && (
        <p
          role="alert"
          className="text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onPress={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          isDisabled={pending}
        >
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Crear"}
        </Button>
      </div>
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
        <p className="text-sm text-danger">{errors[0]}</p>
      ) : null}
    </div>
  )
}
