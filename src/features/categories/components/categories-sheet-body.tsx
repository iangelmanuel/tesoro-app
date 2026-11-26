"use client"

import { useTransition } from "react"
import { Archive, ArchiveRestore, Pencil } from "lucide-react"
import {
  type SortableConfig,
  SortableListItem,
  SortableListProvider,
  useSortableList
} from "@/components/dashboard/data/sortable-list"
import { DetailSection } from "@/components/dashboard/overlays/detail-sheet"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/libs/cn"
import { archiveCategory, moveCategory, restoreCategory } from "../actions"
import type { Category } from "../queries"
import { CategoryBadge } from "./category-badge"
import { CategoryForm } from "./category-form"

type TransactionType = Category["type"]

const TYPE_LABELS: Record<TransactionType, string> = {
  income: "Entradas",
  expense: "Salidas"
}

interface CategoriesSheetBodyProps {
  workspaceId: string
  categories: Category[]
  /** Tab activo: vive en CategoriesSheet para que sobreviva al cerrar */
  type: TransactionType
  onTypeChange: (value: unknown) => void
  editing: Category | null
  onEdit: (category: Category | null) => void
  /** Cambia tras cada guardado para remontar el formulario vacío */
  formVersion: number
  onSaved: () => void
}

/**
 * Tabs de Entradas y Salidas con el formulario y la lista reordenable: lo
 * carga CategoriesSheet al abrir (SPEC 56b), con @dnd-kit en su chunk
 */
export function CategoriesSheetBody({
  workspaceId,
  categories,
  type,
  onTypeChange,
  editing,
  onEdit,
  formVersion,
  onSaved
}: CategoriesSheetBodyProps) {
  return (
    <Tabs
      value={type}
      onValueChange={onTypeChange}
    >
      <TabsList
        aria-label="Tipo de categoría"
        className="w-full"
      >
        {(["expense", "income"] as const).map((tabType) => (
          <TabsTrigger
            key={tabType}
            value={tabType}
          >
            {TYPE_LABELS[tabType]}
          </TabsTrigger>
        ))}
      </TabsList>

      {(["expense", "income"] as const).map((tabType) => (
        <TabsContent
          key={tabType}
          value={tabType}
          className="flex flex-col gap-6 pt-4"
        >
          <CategoryForm
            key={`${editing?.id ?? "new"}-${tabType}-${formVersion}`}
            workspaceId={workspaceId}
            type={tabType}
            category={editing}
            onSaved={onSaved}
            onCancel={() => onEdit(null)}
          />
          <CategoryList
            workspaceId={workspaceId}
            categories={categories.filter((c) => c.type === tabType)}
            editingId={editing?.id}
            onEdit={onEdit}
          />
        </TabsContent>
      ))}
    </Tabs>
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
  // Orden propio de las activas (SPEC 45): los selects lo siguen
  const sortable = useSortableList({
    items: active,
    getId: (category) => category.id,
    getGroup: (category) => category.type,
    getTitle: (category) => category.name,
    handleLabel: "Reordenar categoría",
    onMove: (source, target) => moveCategory(workspaceId, source.id, target.id)
  })

  return (
    <div className="flex flex-col gap-6">
      <CategoryGroup title="Tus categorías">
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no tienes categorías propias.
          </p>
        ) : (
          <SortableListProvider {...sortable.providerProps}>
            {sortable.items.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                sortable={sortable.configFor(category)}
              >
                <Button
                  variant="ghost"
                  size="icon"
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
            ))}
          </SortableListProvider>
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
    <DetailSection title={title}>
      <ul className="flex flex-col gap-1">{children}</ul>
    </DetailSection>
  )
}

function CategoryRow({
  category,
  muted,
  sortable,
  children
}: {
  category: Category
  muted?: boolean
  /** Solo las propias activas se reordenan (SPEC 45) */
  sortable?: SortableConfig
  children?: React.ReactNode
}) {
  return (
    <SortableListItem
      config={sortable}
      className="flex min-h-11 items-center justify-between gap-2 rounded-2xl"
    >
      {(handle) => (
        <>
          <div className="flex min-w-0 items-center gap-1">
            {handle}
            <CategoryBadge
              name={category.name}
              icon={category.icon}
              color={category.color}
              className={cn(muted && "opacity-60")}
            />
          </div>
          {children && (
            <div className="flex items-center gap-1">{children}</div>
          )}
        </>
      )}
    </SortableListItem>
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
      size="icon"
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
