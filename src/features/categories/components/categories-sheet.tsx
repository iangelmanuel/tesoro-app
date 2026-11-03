"use client"

import { useActionState, useState, useTransition } from "react"
import { Button, Drawer, Tabs, cn, toast } from "@heroui/react"
import { Archive, ArchiveRestore, Pencil, Tags } from "lucide-react"
import { CONTROL_BUTTON } from "@/components/dashboard/surface"
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
  /** Botón de 44 px a todo el ancho (dentro de la hoja de filtros) */
  fullWidthTrigger?: boolean
}

export function CategoriesSheet({
  workspaceId,
  categories,
  fullWidthTrigger = false
}: CategoriesSheetProps) {
  const [type, setType] = useState<TransactionType>("expense")
  const [editing, setEditing] = useState<Category | null>(null)
  // Cambia tras cada guardado para remontar el formulario vacío
  const [formVersion, setFormVersion] = useState(0)

  function handleTypeChange(value: React.Key) {
    setType(value as TransactionType)
    setEditing(null)
  }

  function handleSaved() {
    setEditing(null)
    setFormVersion((version) => version + 1)
  }

  return (
    <Drawer>
      <Button
        variant={fullWidthTrigger ? "secondary" : "ghost"}
        size={fullWidthTrigger ? "sm" : undefined}
        fullWidth={fullWidthTrigger}
        className={cn(
          "min-h-11",
          // En la barra: igual que Verificar y el mes. En la hoja, el
          // botón secundario de siempre
          !fullWidthTrigger && CONTROL_BUTTON
        )}
      >
        <Tags />
        Categorías
      </Button>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="w-full sm:max-w-md">
            <Drawer.CloseTrigger aria-label="Cerrar" />
            <Drawer.Header>
              <Drawer.Heading>Categorías</Drawer.Heading>
              <p className="text-sm text-muted">
                Las del sistema son fijas. Las tuyas se pueden editar, archivar
                y restaurar.
              </p>
            </Drawer.Header>

            <Drawer.Body>
              <Tabs
                selectedKey={type}
                onSelectionChange={handleTypeChange}
              >
                <Tabs.ListContainer>
                  <Tabs.List
                    aria-label="Tipo de categoría"
                    className="w-full"
                  >
                    {(["expense", "income"] as const).map((tabType) => (
                      <Tabs.Tab
                        key={tabType}
                        id={tabType}
                        className="flex-1"
                      >
                        {TYPE_LABELS[tabType]}
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </Tabs.ListContainer>

                {(["expense", "income"] as const).map((tabType) => (
                  <Tabs.Panel
                    key={tabType}
                    id={tabType}
                    className="flex flex-col gap-6 pt-4"
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
                  </Tabs.Panel>
                ))}
              </Tabs>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
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
          <p className="text-sm text-muted">
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
                size="sm"
                isIconOnly
                aria-label={`Editar ${category.name}`}
                aria-pressed={editingId === category.id}
                onPress={() => onEdit(category)}
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
      <h3 className="text-xs font-medium text-muted uppercase">{title}</h3>
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
        toast.danger(result.error)
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
      size="sm"
      isIconOnly
      aria-label={
        isArchived ? `Restaurar ${category.name}` : `Archivar ${category.name}`
      }
      isDisabled={pending}
      onPress={handleClick}
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
      className="flex flex-col gap-4 rounded-xl border border-border p-4"
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
          className="text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {isEditing && (
          <Button
            variant="ghost"
            onPress={onCancel}
          >
            Cancelar
          </Button>
        )}
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
