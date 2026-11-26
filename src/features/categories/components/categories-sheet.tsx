"use client"

import { Suspense, useState } from "react"
import { DetailSheet } from "@/components/dashboard/overlays/detail-sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { lazyWithPreload } from "@/libs/lazy-with-preload"
import type { Category } from "../queries"

type TransactionType = Category["type"]

// Tabs, formulario y lista reordenable (@dnd-kit) se descargan al abrir el
// panel o al pasar por su disparador (SPEC 56b)
const CategoriesSheetBody = lazyWithPreload(() =>
  import("./categories-sheet-body").then((m) => m.CategoriesSheetBody)
)

/** Precarga el cuerpo de Categorías: `onPointerEnter` / `onFocus` */
export const preloadCategoriesSheet = CategoriesSheetBody.preload

/** Hueco del cuerpo: tabs, el formulario de alta y las filas de la lista */
function CategoriesSheetBodySkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-6"
    >
      <Skeleton className="h-11 w-full rounded-4xl" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-11 w-full rounded-4xl" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton
            key={index}
            className="h-11 w-full rounded-2xl"
          />
        ))}
      </div>
    </div>
  )
}

interface CategoriesSheetProps {
  /** Espacio dueño de las categorías propias */
  workspaceId: string
  categories: Category[]
  /** Se abre desde el menú Más y la hoja de acciones rápidas */
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CategoriesSheet({
  workspaceId,
  categories,
  open,
  onOpenChange
}: CategoriesSheetProps) {
  const [type, setType] = useState<TransactionType>("expense")
  const [editing, setEditing] = useState<Category | null>(null)
  // Cambia tras cada guardado para remontar el formulario vacío
  const [formVersion, setFormVersion] = useState(0)

  function handleTypeChange(value: unknown) {
    setType(value as TransactionType)
    setEditing(null)
  }

  function handleSaved() {
    setEditing(null)
    setFormVersion((version) => version + 1)
  }

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Categorías"
      description="Las del sistema son fijas. Las tuyas se pueden editar, archivar y restaurar."
      action={
        <Suspense fallback={<CategoriesSheetBodySkeleton />}>
          <CategoriesSheetBody.Component
            workspaceId={workspaceId}
            categories={categories}
            type={type}
            onTypeChange={handleTypeChange}
            editing={editing}
            onEdit={setEditing}
            formVersion={formVersion}
            onSaved={handleSaved}
          />
        </Suspense>
      }
    />
  )
}
