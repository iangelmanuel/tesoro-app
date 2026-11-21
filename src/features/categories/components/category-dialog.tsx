"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import type { Category } from "../queries"
import { CategoryForm } from "./category-form"

interface CategoryDialogProps {
  workspaceId: string
  /** Tipo de la categoría nueva: el del formulario que la pide */
  type: Category["type"]
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (category: Category) => void
}

/**
 * Crea una categoría encima de otro formulario (selects con creación). Es un
 * diálogo anidado: Escape cierra solo este y el foco vuelve al select
 */
export function CategoryDialog({
  workspaceId,
  type,
  open,
  onOpenChange,
  onCreated
}: CategoryDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {type === "expense"
              ? "Nueva categoría de salida"
              : "Nueva categoría de entrada"}
          </DialogTitle>
        </DialogHeader>
        {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
        <CategoryForm
          workspaceId={workspaceId}
          type={type}
          category={null}
          inDialog
          onSaved={(created) => {
            if (created) onCreated(created)
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
