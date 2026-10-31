"use client"

import { useActionState, useState, useTransition } from "react"
import { cn } from "cn"
import { Archive, ArchiveRestore, Pencil, Tags } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FormField } from "@/features/auth/components/form-field"
import {
  archiveCategory,
  createCategory,
  restoreCategory,
  updateCategory
} from "../actions"
import type { Category } from "../queries"
import type { CategoryFormState } from "../types"
import { CategoryBadge } from "./category-badge"
import { IconColorPicker } from "./icon-color-picker"

type TransactionType = Category["type"]

const TYPE_LABELS: Record<TransactionType, string> = {
  income: "Ingresos",
  expense: "Gastos"
}

interface CategoriesSheetProps {
  /** Espacio dueño de las categorías propias */
  workspaceId: string
  categories: Category[]
}

export function CategoriesSheet({
  workspaceId,
  categories
}: CategoriesSheetProps) {
  const [type, setType] = useState<TransactionType>("expense")
  const [editing, setEditing] = useState<Category | null>(null)
  // Cambia tras cada guardado para remontar el formulario vacío
  const [formVersion, setFormVersion] = useState(0)

  function handleTypeChange(value: string) {
    setType(value as TransactionType)
    setEditing(null)
  }

  function handleSaved() {
    setEditing(null)
    setFormVersion((version) => version + 1)
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Tags data-icon="inline-start" />
          Categorías
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Categorías</SheetTitle>
          <SheetDescription>
            Las del sistema son fijas. Las tuyas se pueden editar, archivar y
            restaurar.
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={type}
          onValueChange={handleTypeChange}
          className="px-4 pb-4"
        >
          <TabsList className="w-full">
            <TabsTrigger value="expense">{TYPE_LABELS.expense}</TabsTrigger>
            <TabsTrigger value="income">{TYPE_LABELS.income}</TabsTrigger>
          </TabsList>

          {(["expense", "income"] as const).map((tabType) => (
            <TabsContent
              key={tabType}
              value={tabType}
              className="flex flex-col gap-6 pt-2"
            >
              <CategoryForm
                key={`${editing?.id ?? "new"}-${tabType}-${formVersion}`}
                workspaceId={workspaceId}
                type={tabType}
                category={editing}
                onSaved={handleSaved}
                onCancel={() => setEditing(null)}
              />
              <CategoryList
                workspaceId={workspaceId}
                categories={categories.filter((c) => c.type === tabType)}
                editingId={editing?.id}
                onEdit={setEditing}
              />
            </TabsContent>
          ))}
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

interface CategoryListProps {
  workspaceId: string
  categories: Category[]
  editingId?: string
  onEdit: (category: Category) => void
}

function CategoryList({
  workspaceId,
  categories,
  editingId,
  onEdit
}: CategoryListProps) {
  const system = categories.filter((c) => c.workspace_id === null)
  const own = categories.filter((c) => c.workspace_id !== null)
  const active = own.filter((c) => c.archived_at === null)
  const archived = own.filter((c) => c.archived_at !== null)

  return (
    <div className="flex flex-col gap-6">
      <CategoryGroup title="Tus categorías">
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no tienes categorías propias.
          </p>
        ) : (
          active.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Editar ${category.name}`}
                aria-pressed={editingId === category.id}
                onClick={() => onEdit(category)}
              >
                <Pencil />
              </Button>
              <ArchiveButton
                workspaceId={workspaceId}
                category={category}
              />
            </CategoryRow>
          ))
        )}
      </CategoryGroup>

      {archived.length > 0 && (
        <CategoryGroup title="Archivadas">
          {archived.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              muted
            >
              <ArchiveButton
                workspaceId={workspaceId}
                category={category}
              />
            </CategoryRow>
          ))}
        </CategoryGroup>
      )}

      <CategoryGroup title="Del sistema">
        {system.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
          />
        ))}
      </CategoryGroup>
    </div>
  )
}

function CategoryGroup({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground uppercase">
        {title}
      </h3>
      <ul className="flex flex-col gap-1">{children}</ul>
    </section>
  )
}

function CategoryRow({
  category,
  muted,
  children
}: {
  category: Category
  muted?: boolean
  children?: React.ReactNode
}) {
  return (
    <li className="flex min-h-8 items-center justify-between gap-2">
      <CategoryBadge
        name={category.name}
        icon={category.icon}
        color={category.color}
        className={cn(muted && "opacity-60")}
      />
      {children && <div className="flex items-center gap-1">{children}</div>}
    </li>
  )
}

function ArchiveButton({
  workspaceId,
  category
}: {
  workspaceId: string
  category: Category
}) {
  const [pending, startTransition] = useTransition()
  const isArchived = category.archived_at !== null

  function handleClick() {
    startTransition(async () => {
      const result = isArchived
        ? await restoreCategory(workspaceId, category.id)
        : await archiveCategory(workspaceId, category.id)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(
          isArchived
            ? `"${category.name}" se restauró`
            : `"${category.name}" se archivó`
        )
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={
        isArchived ? `Restaurar ${category.name}` : `Archivar ${category.name}`
      }
      disabled={pending}
      onClick={handleClick}
    >
      {isArchived ? <ArchiveRestore /> : <Archive />}
    </Button>
  )
}

interface CategoryFormProps {
  workspaceId: string
  type: TransactionType
  category: Category | null
  onSaved: () => void
  onCancel: () => void
}

function CategoryForm({
  workspaceId,
  type,
  category,
  onSaved,
  onCancel
}: CategoryFormProps) {
  const isEditing = category !== null && category.type === type

  const [state, formAction, pending] = useActionState<
    CategoryFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isEditing
      ? await updateCategory(prevState, formData)
      : await createCategory(prevState, formData)

    if (result.ok) {
      toast.success(isEditing ? "Categoría actualizada" : "Categoría creada")
      onSaved()
    }
    return result
  }, {})

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border p-4"
      noValidate
    >
      <h3 className="text-sm font-medium">
        {isEditing ? `Editar "${category.name}"` : "Nueva categoría"}
      </h3>

      {isEditing && (
        <input
          type="hidden"
          name="id"
          value={category.id}
        />
      )}
      <input
        type="hidden"
        name="workspace_id"
        value={workspaceId}
      />
      <input
        type="hidden"
        name="type"
        value={type}
      />

      <FormField
        name="name"
        label="Nombre"
        maxLength={40}
        placeholder={type === "expense" ? "Mascotas" : "Arriendos"}
        defaultValue={
          state.values?.name ?? (isEditing ? category.name : undefined)
        }
        errors={state.fieldErrors?.name}
        required
      />

      <IconColorPicker
        defaultIcon={isEditing ? category.icon : undefined}
        defaultColor={isEditing ? category.color : undefined}
        iconErrors={state.fieldErrors?.icon}
        colorErrors={state.fieldErrors?.color}
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
        {isEditing && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
          >
            Cancelar
          </Button>
        )}
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
