"use client"

import { useState } from "react"
import { Copy, Pencil, Trash2 } from "lucide-react"
import type { RowAction } from "@/components/dashboard/data/row-actions"
import { DeleteDialog } from "@/components/dashboard/overlays/delete-dialog"
import { useActionToast } from "@/hooks/use-action-toast"
import { useOpenedOnce } from "@/hooks/use-opened-once"

interface RemoveConfig {
  title: string
  success: string
  onDelete: () => Promise<{ error?: string }>
}

/** Estado de un diálogo de la fila, controlado desde el menú */
export interface RowDialogControl {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Acciones de una fila: Editar y Duplicar (si hay diálogo) y Eliminar */
export interface EntryConfig {
  /** Nombre de la fila para los avisos y los menús */
  label: string
  remove: RemoveConfig
  renderEdit?: (dialog: RowDialogControl) => React.ReactNode
  /** Diálogo de crear prellenado con los datos de la fila (SPEC 49) */
  renderDuplicate?: (dialog: RowDialogControl) => React.ReactNode
}

/**
 * Acciones de una fila. La misma lista sirve al botón ⋯ (o los botones en
 * línea en el teléfono) y al menú contextual de la fila. Los diálogos se
 * controlan desde aquí porque los menús no pueden alojar triggers. Cada uno
 * se monta la primera vez que se abre (SPEC 57): una tabla de 50 filas no
 * hidrata 150 diálogos cerrados al entrar
 */
export function useEntryActions({
  label,
  remove,
  renderEdit,
  renderDuplicate
}: EntryConfig) {
  const [editing, setEditing] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const editOpened = useOpenedOnce(editing)
  const duplicateOpened = useOpenedOnce(duplicating)
  const deleteOpened = useOpenedOnce(deleting)

  const actions: RowAction[] = [
    ...(renderEdit
      ? [
          {
            id: "edit",
            label: "Editar",
            icon: <Pencil />,
            onAction: () => setEditing(true)
          }
        ]
      : []),
    ...(renderDuplicate
      ? [
          {
            id: "duplicate",
            label: "Duplicar",
            icon: <Copy />,
            onAction: () => setDuplicating(true)
          }
        ]
      : []),
    {
      id: "delete",
      label: "Eliminar",
      icon: <Trash2 />,
      destructive: true,
      onAction: () => setDeleting(true)
    }
  ]

  const dialogs = (
    <>
      {editOpened && renderEdit?.({ open: editing, onOpenChange: setEditing })}
      {duplicateOpened &&
        renderDuplicate?.({ open: duplicating, onOpenChange: setDuplicating })}
      {deleteOpened && (
        <DeleteEntryDialog
          label={label}
          {...remove}
          open={deleting}
          onOpenChange={setDeleting}
        />
      )}
    </>
  )

  return { actions, dialogs }
}

function DeleteEntryDialog({
  label,
  title,
  success,
  onDelete,
  open,
  onOpenChange
}: RemoveConfig & {
  label: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { run } = useActionToast()

  return (
    <DeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      onConfirm={() => run(onDelete, success)}
    >
      <p>
        &ldquo;{label}&rdquo; se eliminará de forma permanente. Esta acción no
        se puede deshacer.
      </p>
    </DeleteDialog>
  )
}
