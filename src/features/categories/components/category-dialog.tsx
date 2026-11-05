"use client"

import { Modal } from "@heroui/react"
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
 * Modal anidado: Escape cierra solo este y el foco vuelve al select.
 */
export function CategoryDialog({
  workspaceId,
  type,
  open,
  onOpenChange,
  onCreated
}: CategoryDialogProps) {
  return (
    <Modal
      isOpen={open}
      onOpenChange={onOpenChange}
    >
      <Modal.Backdrop>
        <Modal.Container scroll="outside">
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {type === "expense"
                  ? "Nueva categoría de gasto"
                  : "Nueva categoría de ingreso"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
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
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
